// Miniscript bundle: policy compiler + miniscript analyser + satisfier
// + descriptor parsing, address derivation, and timelock conversion.
// Exposed as `window.miniscript`.

const policies = require('@bitcoinerlab/miniscript-policies');
const miniscriptLib = require('@bitcoinerlab/miniscript');
const descriptorsLib = require('@bitcoinerlab/descriptors');
const ecc = require('@bitcoinerlab/secp256k1');

const { Output, expand } = descriptorsLib.DescriptorsFactory(ecc);
const { networks: descNetworks, checksum: descriptorChecksum } = descriptorsLib;

const ready = policies.ready;

// ---------------------------------------------------------------------------
// ASM helpers
// ---------------------------------------------------------------------------

const OP_CODES = {
  OP_0: 0x00, OP_FALSE: 0x00,
  OP_1NEGATE: 0x4f,
  OP_1: 0x51, OP_TRUE: 0x51,
  OP_2: 0x52, OP_3: 0x53, OP_4: 0x54, OP_5: 0x55, OP_6: 0x56, OP_7: 0x57,
  OP_8: 0x58, OP_9: 0x59, OP_10: 0x5a, OP_11: 0x5b, OP_12: 0x5c,
  OP_13: 0x5d, OP_14: 0x5e, OP_15: 0x5f, OP_16: 0x60,
  OP_NOP: 0x61, OP_VER: 0x62,
  OP_IF: 0x63, OP_NOTIF: 0x64, OP_ELSE: 0x67, OP_ENDIF: 0x68,
  OP_VERIFY: 0x69, OP_RETURN: 0x6a,
  OP_TOALTSTACK: 0x6b, OP_FROMALTSTACK: 0x6c,
  OP_2DROP: 0x6d, OP_2DUP: 0x6e, OP_3DUP: 0x6f, OP_2OVER: 0x70,
  OP_2ROT: 0x71, OP_2SWAP: 0x72, OP_IFDUP: 0x73, OP_DEPTH: 0x74,
  OP_DROP: 0x75, OP_DUP: 0x76, OP_NIP: 0x77, OP_OVER: 0x78,
  OP_PICK: 0x79, OP_ROLL: 0x7a, OP_ROT: 0x7b, OP_SWAP: 0x7c, OP_TUCK: 0x7d,
  OP_SIZE: 0x82,
  OP_EQUAL: 0x87, OP_EQUALVERIFY: 0x88,
  OP_1ADD: 0x8b, OP_1SUB: 0x8c, OP_NEGATE: 0x8f, OP_ABS: 0x90,
  OP_NOT: 0x91, OP_0NOTEQUAL: 0x92,
  OP_ADD: 0x93, OP_SUB: 0x94,
  OP_BOOLAND: 0x9a, OP_BOOLOR: 0x9b,
  OP_NUMEQUAL: 0x9c, OP_NUMEQUALVERIFY: 0x9d, OP_NUMNOTEQUAL: 0x9e,
  OP_LESSTHAN: 0x9f, OP_GREATERTHAN: 0xa0,
  OP_LESSTHANOREQUAL: 0xa1, OP_GREATERTHANOREQUAL: 0xa2,
  OP_MIN: 0xa3, OP_MAX: 0xa4,
  OP_WITHIN: 0xa5,
  OP_RIPEMD160: 0xa6, OP_SHA1: 0xa7, OP_SHA256: 0xa8,
  OP_HASH160: 0xa9, OP_HASH256: 0xaa,
  OP_CODESEPARATOR: 0xab,
  OP_CHECKSIG: 0xac, OP_CHECKSIGVERIFY: 0xad,
  OP_CHECKMULTISIG: 0xae, OP_CHECKMULTISIGVERIFY: 0xaf,
  OP_NOP1: 0xb0,
  OP_CHECKLOCKTIMEVERIFY: 0xb1, OP_CLTV: 0xb1,
  OP_CHECKSEQUENCEVERIFY: 0xb2, OP_CSV: 0xb2,
  OP_CHECKSIGADD: 0xba,
};

function hexToBytes(hex) {
  if (hex.length % 2) throw new Error('Odd hex string');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Encode a single push of `data` bytes as Bitcoin Script
function pushBytes(data) {
  const len = data.length;
  if (len === 0) return Uint8Array.of(0x00);
  if (len === 1 && data[0] >= 1 && data[0] <= 16) return Uint8Array.of(0x50 + data[0]); // OP_1..OP_16
  if (len === 1 && data[0] === 0x81) return Uint8Array.of(0x4f); // OP_1NEGATE
  let prefix;
  if (len < 0x4c) prefix = Uint8Array.of(len);
  else if (len <= 0xff) prefix = Uint8Array.of(0x4c, len);
  else if (len <= 0xffff) prefix = Uint8Array.of(0x4d, len & 0xff, (len >> 8) & 0xff);
  else prefix = Uint8Array.of(0x4e, len & 0xff, (len >> 8) & 0xff, (len >> 16) & 0xff, (len >> 24) & 0xff);
  const out = new Uint8Array(prefix.length + data.length);
  out.set(prefix, 0);
  out.set(data, prefix.length);
  return out;
}

// Encode a script integer (CScriptNum) for a numeric push (used by older(n), after(n))
function encodeScriptNum(n) {
  if (n === 0) return new Uint8Array(0);
  const negative = n < 0;
  let abs = Math.abs(n);
  const bytes = [];
  while (abs) {
    bytes.push(abs & 0xff);
    abs = Math.floor(abs / 256);
  }
  if (bytes[bytes.length - 1] & 0x80) bytes.push(negative ? 0x80 : 0x00);
  else if (negative) bytes[bytes.length - 1] |= 0x80;
  return new Uint8Array(bytes);
}

// Convert the ASM string the compiler returns into raw Bitcoin Script bytes.
// Tokens: `OP_*` opcodes or `<...>` data pushes (hex inside).
// Returns null if any push is a symbolic placeholder (e.g. `<A>`, `<Alice>`).
function asmToScript(asm) {
  if (!asm) return new Uint8Array(0);
  const tokens = asm.split(/\s+/).filter(Boolean);
  const chunks = [];
  let symbolic = false;
  for (const t of tokens) {
    if (t.startsWith('<') && t.endsWith('>')) {
      const inner = t.slice(1, -1);
      if (/^-?\d+$/.test(inner)) {
        chunks.push(pushBytes(encodeScriptNum(Number(inner))));
      } else if (/^[0-9a-fA-F]+$/.test(inner) && inner.length % 2 === 0) {
        chunks.push(pushBytes(hexToBytes(inner.toLowerCase())));
      } else {
        symbolic = true;
        break;
      }
    } else if (OP_CODES[t] !== undefined) {
      chunks.push(Uint8Array.of(OP_CODES[t]));
    } else {
      symbolic = true;
      break;
    }
  }
  if (symbolic) return null;
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

// ---------------------------------------------------------------------------
// Spend-path summarisation
// ---------------------------------------------------------------------------

// A satisfier `Solution` looks like:
//   { asm: '<sig(A)> <sig(B)>', nSequence?: N, nLockTime?: N }
// We mine out the human-meaningful conditions per branch.

function summariseSolution(sol) {
  const items = (sol.asm || '').trim().split(/\s+/).filter(Boolean);
  const sigKeys = [];
  const preimages = [];
  const literals = [];
  for (const tok of items) {
    let m;
    if ((m = tok.match(/^<sig\(([^)]+)\)>$/))) sigKeys.push(m[1]);
    else if ((m = tok.match(/^<(ripemd160|sha256|hash160|hash256)_preimage\(([^)]+)\)>$/))) {
      preimages.push({ hash: m[1].toUpperCase(), digest: m[2] });
    } else literals.push(tok);
  }
  return {
    asm: sol.asm,
    sigKeys,
    preimages,
    literals,
    nSequence: sol.nSequence,
    nLockTime: sol.nLockTime,
  };
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

function bytesOrNull(asm) {
  try { return asmToScript(asm); } catch (_) { return null; }
}

/** Compile a Policy (high-level) for P2WSH context. */
function compilePolicyP2wsh(policy) {
  const r = policies.compilePolicy(policy);
  const bytes = r.issane ? bytesOrNull(r.asm) : null;
  return {
    miniscript: r.miniscript,
    asm: r.asm,
    issane: r.issane,
    issanesublevel: r.issanesublevel,
    scriptHex: bytes ? bytesToHex(bytes) : null,
    scriptBytes: bytes ? bytes.length : null,
  };
}

/** Compile a Policy for Tapscript context (rewrites multi → multi_a). */
function compilePolicyTaproot(policy) {
  const r = policies.compilePolicyTaproot(policy);
  let out = { miniscript: r.miniscript, issane: r.issane };
  if (r.issane) {
    try {
      const ms = miniscriptLib.compileMiniscript(r.miniscript, { tapscript: true });
      out.asm = ms.asm;
      const bytes = bytesOrNull(ms.asm);
      out.scriptHex = bytes ? bytesToHex(bytes) : null;
      out.scriptBytes = bytes ? bytes.length : null;
    } catch (_) { /* leave asm undefined */ }
  }
  return out;
}

/** Compile a Miniscript expression directly (skip policy). */
function compileMiniscript(expr, tapscript) {
  const r = miniscriptLib.compileMiniscript(expr, tapscript ? { tapscript: true } : undefined);
  const bytes = r.issane && !r.error ? bytesOrNull(r.asm) : null;
  return {
    asm: r.asm,
    issane: r.issane,
    issanesublevel: r.issanesublevel,
    error: r.error,
    scriptHex: bytes ? bytesToHex(bytes) : null,
    scriptBytes: bytes ? bytes.length : null,
  };
}

/** Run static analysis on a Miniscript expression. */
function analyze(expr, tapscript) {
  return miniscriptLib.analyzeMiniscript(expr, tapscript ? { tapscript: true } : undefined);
}

/** Enumerate spend paths from a Miniscript expression. */
function spendPaths(expr, tapscript) {
  const opts = tapscript ? { tapscript: true } : undefined;
  const r = miniscriptLib.satisfier(expr, opts);
  return {
    nonMalleable: r.nonMalleableSats.map(summariseSolution),
    malleable: r.malleableSats.map(summariseSolution),
  };
}

// ---------------------------------------------------------------------------
// Descriptor parsing
// ---------------------------------------------------------------------------

const TOP_LEVEL_WRAPPERS = ['sh', 'wsh', 'tr', 'wpkh', 'pkh', 'pk', 'combo', 'addr', 'raw', 'multi', 'sortedmulti'];
function looksLikeDescriptor(s) {
  if (typeof s !== 'string') return false;
  const m = s.trim().match(/^([a-z_]+)\s*\(/);
  return !!(m && TOP_LEVEL_WRAPPERS.includes(m[1]));
}

function detectWrapperContext(desc) {
  const m = desc.trim().match(/^([a-z_]+)\s*\(/);
  if (!m) return { wrapper: null, tapscript: false };
  const w = m[1];
  if (w === 'wsh' || w === 'sh') return { wrapper: w, tapscript: false };
  if (w === 'tr')                 return { wrapper: 'tr', tapscript: true };
  return { wrapper: w, tapscript: false };
}

function hasMultipath(desc) {
  // Explicit BIP-389 form: <0;1>/* etc. Also accept the /** shorthand (also BIP-389).
  return /<\s*\d+(?:\s*;\s*\d+)+\s*>/.test(desc) || /\/\*\*/.test(desc);
}
function isRanged(desc) {
  return /\*/.test(desc);
}
function stripChecksum(desc) {
  return desc.replace(/#[0-9a-z]{8}$/, '');
}
function ensureChecksum(desc) {
  if (/#[0-9a-z]{8}$/.test(desc)) return desc;
  try { return desc + '#' + descriptorChecksum(desc); } catch (_) { return desc; }
}

/**
 * Parse a descriptor string. Returns:
 *   { wrapper, tapscript, isMultipath, isRanged, miniscript, checksum, expanded, error }
 */
function parseDescriptor(input) {
  if (typeof input !== 'string') throw new Error('Descriptor must be a string');
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Empty descriptor');
  const ctx = detectWrapperContext(trimmed);
  if (!ctx.wrapper) return { wrapper: null, error: 'Could not identify the descriptor wrapper (expected wsh, tr, sh, wpkh, ...)' };

  const bare = stripChecksum(trimmed);
  const withCs = ensureChecksum(bare);
  const out = {
    wrapper: ctx.wrapper,
    tapscript: ctx.tapscript,
    isMultipath: hasMultipath(bare),
    isRanged: isRanged(bare),
    checksum: withCs.slice(-8),
    descriptor: withCs,
    miniscript: null,
    expandedMiniscript: null,
    keys: [],
    error: null,
  };

  // Auto-detect network from xpub prefix (xpub/ypub/zpub → mainnet, tpub/upub/vpub → testnet).
  const looksTestnet = /\b(t|u|v)pub[A-HJ-NP-Za-km-z1-9]/.test(bare);
  const networksToTry = looksTestnet
    ? [descNetworks.testnet, descNetworks.regtest, descNetworks.bitcoin]
    : [descNetworks.bitcoin, descNetworks.testnet, descNetworks.regtest];

  let ex = null;
  let lastErr = null;
  for (const net of networksToTry) {
    try {
      const expandOpts = { descriptor: bare, network: net, checksumRequired: false };
      if (out.isMultipath) expandOpts.change = 0;
      if (out.isRanged) expandOpts.index = 0;
      ex = expand(expandOpts);
      out.network = net === descNetworks.testnet ? 'testnet'
                  : net === descNetworks.regtest ? 'regtest'
                  : 'mainnet';
      break;
    } catch (e) { lastErr = e; }
  }
  try {
    if (!ex) throw lastErr || new Error('Could not parse descriptor');
    out.miniscript = ex.miniscript;
    out.expandedMiniscript = ex.expandedMiniscript;
    out.canonicalExpression = ex.canonicalExpression;
    out.isSegwit = !!ex.isSegwit;
    out.isTaproot = !!ex.isTaproot;
    out.tapscript = !!ex.isTaproot;
    out.keys = Object.entries(ex.expansionMap || {}).map(([placeholder, info]) => ({
      placeholder,
      keyExpression: info.keyExpression,
      bip32Path: info.bip32Path,
      masterFingerprint: info.masterFingerprint ? Buffer.from(info.masterFingerprint).toString('hex') : null,
      origin: info.originPath ? `${info.masterFingerprint ? Buffer.from(info.masterFingerprint).toString('hex') : ''}${info.originPath}` : null,
      bip32: info.bip32 ? { xpub: info.bip32.toBase58 ? info.bip32.toBase58() : null } : null,
    }));
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

/**
 * Derive a range of addresses from a ranged descriptor.
 *   opts: { count = 10, network = 'mainnet' }
 * Returns { receive: [...], change: [...], error }
 * If the descriptor isn't ranged, returns { single: address }.
 */
function deriveAddresses(input, opts) {
  opts = opts || {};
  const count = Math.max(1, Math.min(opts.count || 10, 50));
  const net = opts.network === 'testnet' ? descNetworks.testnet
            : opts.network === 'regtest' ? descNetworks.regtest
            : descNetworks.bitcoin;
  const bare = stripChecksum(typeof input === 'string' ? input.trim() : '');
  const multipath = hasMultipath(bare);
  const ranged = isRanged(bare);

  function one(opts) {
    const o = new Output({ ...opts, descriptor: bare, network: net, checksumRequired: false });
    return o.getAddress();
  }

  if (!ranged) {
    try { return { single: one({}), multipath, ranged }; }
    catch (e) { return { error: e.message, multipath, ranged }; }
  }

  const receive = [];
  const change = [];
  for (let i = 0; i < count; i++) {
    try {
      const recvOpts = { index: i };
      if (multipath) recvOpts.change = 0;
      receive.push({ index: i, address: one(recvOpts), path: multipath ? `.../0/${i}` : `.../${i}` });
    } catch (e) { receive.push({ index: i, error: e.message }); }

    if (multipath) {
      try {
        change.push({ index: i, address: one({ index: i, change: 1 }), path: `.../1/${i}` });
      } catch (e) { change.push({ index: i, error: e.message }); }
    }
  }
  return { receive, change, multipath, ranged };
}

// ---------------------------------------------------------------------------
// Timelock → human readable
// ---------------------------------------------------------------------------

const BLOCK_SECONDS = 600;       // ~10 minutes per Bitcoin block on average
const SEQUENCE_TIME_FLAG = 0x00400000;
const SEQUENCE_LOCKTIME_MASK = 0x0000ffff;
const LOCKTIME_THRESHOLD = 500_000_000; // < this = block height; >= = unix time

function formatDuration(seconds) {
  const s = Math.round(seconds);
  if (s < 60) return `${s} seconds`;
  const m = s / 60;
  if (m < 60) return `${m.toFixed(0)} minutes`;
  const h = m / 60;
  if (h < 24) return `${h.toFixed(1)} hours`;
  const d = h / 24;
  if (d < 60) return `${Math.round(d)} days`;
  const months = d / 30.44;
  const years = d / 365.25;
  if (years >= 0.95) {
    // Pretty year/month combo: "1 year", "1y 6mo", "2 years"
    const wholeY = Math.round(years);
    const extraMonths = Math.round((years - wholeY) * 12);
    if (extraMonths === 0) return `${wholeY} ${wholeY === 1 ? 'year' : 'years'}`;
    if (extraMonths === 12) return `${wholeY + 1} years`;
    return `${wholeY}y ${extraMonths}mo`;
  }
  return `${Math.round(months)} months (~${Math.round(d)} days)`;
}

/**
 * Human-readable interpretation of `older(N)` (nSequence).
 * Returns { kind, value, label }.
 */
function describeOlder(value) {
  if (typeof value !== 'number') return null;
  if (value & SEQUENCE_TIME_FLAG) {
    const units = value & SEQUENCE_LOCKTIME_MASK;
    const seconds = units * 512;
    return {
      kind: 'time',
      value,
      units,
      seconds,
      label: `~${formatDuration(seconds)} after the funding tx confirms (time-based, ${units} × 512s units)`,
    };
  }
  const blocks = value & 0xffff; // older() max is 65535
  const seconds = blocks * BLOCK_SECONDS;
  return {
    kind: 'blocks',
    value,
    blocks,
    seconds,
    label: `${blocks.toLocaleString()} block confirmations (~${formatDuration(seconds)})`,
  };
}

/**
 * Human-readable interpretation of `after(N)` (nLockTime).
 */
function describeAfter(value) {
  if (typeof value !== 'number') return null;
  if (value < LOCKTIME_THRESHOLD) {
    return {
      kind: 'height',
      value,
      label: `block height ${value.toLocaleString()}`,
    };
  }
  const date = new Date(value * 1000);
  return {
    kind: 'time',
    value,
    date: date.toISOString(),
    label: `${date.toUTCString()} (unix timestamp ${value})`,
  };
}

// ---------------------------------------------------------------------------
// Sample descriptors (Liana + Nunchuk style, using BIP-32 test-vector xpubs)
// ---------------------------------------------------------------------------

// All keys below are real BIP-32 xpubs derived from the well-known
// "abandon × 11 + about" test mnemonic, at m/48'/0'/N'/2' (BIP-48 native segwit
// multisig). They're meant to make the examples self-contained; do NOT use them
// to actually receive bitcoin.
const _FP = '73c5da0a';
const _XPUB = [
  'xpub6DkFAXWQ2dHxq2vatrt9qyA3bXYU4ToWQwCHbf5XB2mSTexcHZCeKS1VZYcPoBd5X8yVcbXFHJR9R8UCVpt82VX1VhR28mCyxUFL4r6KFrf',
  'xpub6DzhyrnFFYQ1HimDiM388xHnDiRPNdZJFBmmxge3Y1WWcHLtMJLfRuhRHqnQCPbTj3fGKTuKFLHzzwpJkp5Dtc3UtLKZKaVZe1yqMBXd6Vk',
  'xpub6EGx8sPr9FxPPE1rbZazhqWwpMXA3Hf5DYKtZbL7c4BSddzmQktp96UaTvecEkoCZysuaj79GMCFZYT1KKk7Ph2M3Kf5g8B82KZ8TZ9SKQR',
  'xpub6E6Z3Ss5TXJYNJp4U1q3NZ3pCn82i7KXQAKUtNnzLJ3cCdchQeSdFvXemizaHUF7wNwRQAB8mPdoZhGHLiv49cWPtCnoJY3Az3E8JKxH9Mq',
  'xpub6EhpCqtVqedgGvswhRdYH3pTh3z7SXMKQWX5LWiAafipEJXvZsoH5RbtQcj2QZV2sT77KmUHpHF9Yh72N47vCqYGuqpw9bjBoFcdeiV7kyM',
];
function _key(i) { return `[${_FP}/48'/0'/${i}'/2']${_XPUB[i]}/<0;1>/*`; }
function _keyPk(i) { return `pk(${_key(i)})`; }
function _keyPkh(i) { return `pkh(${_key(i)})`; }

const SAMPLE_DESCRIPTORS = [
  {
    id: 'vault-2of3',
    title: 'Plain 2-of-3 multisig',
    description: 'Three cosigners, two signatures required to spend. No recovery path - if two keys are lost the funds are unreachable.',
    descriptor: `wsh(multi(2,${_key(0)},${_key(1)},${_key(2)}))`,
  },
  {
    id: 'hodl-1y',
    title: 'Time-locked HODL (1y)',
    description: 'Single key, but the UTXO cannot be spent until ~1 year of confirmations have passed. Self-imposed cold storage.',
    descriptor: `wsh(and_v(v:${_keyPk(0)},older(52560)))`,
  },
  {
    id: 'htlc',
    title: 'HTLC-like (preimage or timeout)',
    description: 'Receiver claims the funds by revealing the preimage of a SHA-256 hash; if they never do, the sender reclaims after 144 blocks. The shape of a Lightning HTLC.',
    descriptor: `wsh(andor(${_keyPk(0)},sha256(2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824),and_v(v:${_keyPk(1)},older(144))))`,
  },
  {
    id: 'liana-1y',
    title: 'Single key + recovery (1y)',
    description: 'Primary key spends anytime; recovery key activates after ~1 year of inactivity.',
    descriptor: `wsh(or_d(${_keyPk(0)},and_v(v:${_keyPkh(1)},older(52560))))`,
  },
  {
    id: 'liana-2of3',
    title: '2-of-3 + cold recovery (6m)',
    description: '2-of-3 multisig with three hot keys; a single cold key alone unlocks the funds after ~180 days.',
    descriptor: `wsh(or_d(multi(2,${_key(0)},${_key(1)},${_key(2)}),and_v(v:${_keyPkh(3)},older(26280))))`,
  },
  {
    id: 'tiered-inherit',
    title: 'Tiered recovery (3m / 1y)',
    description: 'Hot key spends anytime. Cold key alone spends after 3 months. Heir key alone spends after 1 year (the practical max for relative timelocks).',
    descriptor: `wsh(or_d(${_keyPk(0)},or_i(and_v(v:${_keyPkh(1)},older(12960)),and_v(v:${_keyPkh(2)},older(52560)))))`,
  },
];

const api = {
  ready,
  compilePolicyP2wsh,
  compilePolicyTaproot,
  compileMiniscript,
  analyze,
  spendPaths,
  asmToScript,
  bytesToHex,
  // New descriptor support
  looksLikeDescriptor,
  parseDescriptor,
  deriveAddresses,
  describeOlder,
  describeAfter,
  SAMPLE_DESCRIPTORS,
};

if (typeof window !== 'undefined') window.miniscript = api;
module.exports = api;
