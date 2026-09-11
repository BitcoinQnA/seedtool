/*
 * Key, descriptor and SeedQR helpers that need no page state: Nostr keys
 * (NIP-06 and BIP-85), single-sig output descriptors with BIP-380
 * checksums, and SeedQR encoding and decoding. Exposed as window.seedKeys.
 *
 * Uses the page's bundled bip39, bip32, bip85 and bitcoin libraries.
 * Tested against the published vectors in test/keys.test.js.
 */
(function () {
  'use strict';

  const toHex = (bytes) =>
    Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

  const fromHex = (hex) => {
    if (!/^([0-9a-f]{2})*$/i.test(hex)) throw new Error('Not a hex string');
    return Uint8Array.from(hex.match(/../g) || [], (h) => parseInt(h, 16));
  };

  const wholeNumber = (value, min, label) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n >= 2 ** 31) {
      throw new Error(`${label} must be a whole number from ${min}`);
    }
    return n;
  };

  // The tool's root key is shown in mainnet form, but accept testnet too
  const parseRoot = (rootKey) => {
    try {
      return bip32.fromBase58(rootKey);
    } catch (error) {
      return bip32.fromBase58(rootKey, bitcoin.networks.testnet);
    }
  };

  // ---------------------------------------------------------------------
  // Bech32 (BIP-173), used by Nostr's npub and nsec encodings (NIP-19)
  // ---------------------------------------------------------------------
  const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const BECH32_GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

  const bech32Polymod = (values) => {
    let chk = 1;
    for (const value of values) {
      const top = chk >>> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ value;
      for (let i = 0; i < 5; i++) {
        if ((top >>> i) & 1) chk ^= BECH32_GENERATOR[i];
      }
    }
    return chk >>> 0;
  };

  const hrpExpand = (hrp) => [
    ...Array.from(hrp, (c) => c.charCodeAt(0) >> 5),
    0,
    ...Array.from(hrp, (c) => c.charCodeAt(0) & 31),
  ];

  const convertBits = (data, fromBits, toBits, pad) => {
    let acc = 0;
    let bits = 0;
    const out = [];
    const maxValue = (1 << toBits) - 1;
    for (const value of data) {
      acc = (acc << fromBits) | value;
      bits += fromBits;
      while (bits >= toBits) {
        bits -= toBits;
        out.push((acc >> bits) & maxValue);
      }
    }
    if (pad && bits > 0) out.push((acc << (toBits - bits)) & maxValue);
    return out;
  };

  const bech32Encode = (hrp, bytes) => {
    const data = convertBits(bytes, 8, 5, true);
    const polymod = bech32Polymod([...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
    const checksum = [0, 1, 2, 3, 4, 5].map((i) => (polymod >>> (5 * (5 - i))) & 31);
    return `${hrp}1${[...data, ...checksum].map((v) => BECH32_CHARSET[v]).join('')}`;
  };

  // ---------------------------------------------------------------------
  // Nostr keys
  // ---------------------------------------------------------------------

  // A Nostr key pair from a 32-byte secp256k1 private key. The public key is
  // the 32-byte x coordinate (BIP-340).
  const nostrKeys = (privateKey) => {
    const keyPair = bitcoin.ECPair.fromPrivateKey(Buffer.Buffer.from(privateKey));
    const publicKey = keyPair.publicKey.slice(1, 33);
    return {
      privateKeyHex: toHex(privateKey),
      nsec: bech32Encode('nsec', privateKey),
      publicKeyHex: toHex(publicKey),
      npub: bech32Encode('npub', publicKey),
    };
  };

  // NIP-06: m/44'/1237'/<account>'/0/0
  const nip06 = (rootKey, account = 0) => {
    const index = wholeNumber(account, 0, 'Account');
    const path = `m/44'/1237'/${index}'/0/0`;
    const node = parseRoot(rootKey).derivePath(path);
    return { path, ...nostrKeys(node.privateKey) };
  };

  // BIP-85 Nostr application: m/83696968'/128002'/<identity>'/<account>'.
  // Index 0 is reserved by the spec, so both start at 1.
  const bip85Nostr = (rootKey, identity = 1, account = 1) => {
    const id = wholeNumber(identity, 1, 'Identity');
    const acc = wholeNumber(account, 1, 'Account');
    const path = `m/83696968'/128002'/${id}'/${acc}'`;
    const entropyHex = bip85.BIP85.fromBase58(parseRoot(rootKey).toBase58()).derive(path);
    return { path, entropyHex, ...nostrKeys(fromHex(entropyHex.slice(0, 64))) };
  };

  // ---------------------------------------------------------------------
  // Output descriptors with BIP-380 checksums
  // ---------------------------------------------------------------------
  const DESCRIPTOR_CHARSET =
    '0123456789()[],\'/*abcdefgh@:$%{}IJKLMNOPQRSTUVWXYZ&+-.;<=>?!^_|~ijklmnopqrstuvwxyzABCDEFGH`#"\\ ';
  const CHECKSUM_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const DESCRIPTOR_GENERATOR = [
    0xf5dee51989n, 0xa9fdca3312n, 0x1bab10e32dn, 0x3706b1677an, 0x644d626ffdn,
  ];

  const descriptorPolymod = (symbols) => {
    let chk = 1n;
    for (const value of symbols) {
      const top = chk >> 35n;
      chk = ((chk & 0x7ffffffffn) << 5n) ^ BigInt(value);
      for (let i = 0; i < 5; i++) {
        if ((top >> BigInt(i)) & 1n) chk ^= DESCRIPTOR_GENERATOR[i];
      }
    }
    return chk;
  };

  const descriptorChecksum = (descriptor) => {
    const symbols = [];
    let groups = [];
    for (const c of descriptor) {
      const value = DESCRIPTOR_CHARSET.indexOf(c);
      if (value < 0) throw new Error(`"${c}" is not allowed in a descriptor`);
      symbols.push(value & 31);
      groups.push(value >> 5);
      if (groups.length === 3) {
        symbols.push(groups[0] * 9 + groups[1] * 3 + groups[2]);
        groups = [];
      }
    }
    if (groups.length === 1) symbols.push(groups[0]);
    if (groups.length === 2) symbols.push(groups[0] * 3 + groups[1]);
    const chk = descriptorPolymod([...symbols, 0, 0, 0, 0, 0, 0, 0, 0]) ^ 1n;
    return Array.from({ length: 8 }, (_, i) =>
      CHECKSUM_CHARSET[Number((chk >> BigInt(5 * (7 - i))) & 31n)]
    ).join('');
  };

  const withChecksum = (descriptor) => `${descriptor}#${descriptorChecksum(descriptor)}`;

  const SCRIPT_FOR_PURPOSE = {
    44: (key) => `pkh(${key})`,
    49: (key) => `sh(wpkh(${key}))`,
    84: (key) => `wpkh(${key})`,
    86: (key) => `tr(${key})`,
  };

  // Single-sig descriptors for a standard account, with key origin. Returns
  // separate receive and change descriptors for wallets that need them, and
  // the combined BIP-389 multipath form (<0;1>).
  const singleSigDescriptors = (rootKey, { purpose, coin = 0, account = 0, testnet = false }) => {
    const wrap = SCRIPT_FOR_PURPOSE[purpose];
    if (!wrap) throw new Error(`There is no standard single-sig descriptor for purpose ${purpose}`);
    const coinType = wholeNumber(coin, 0, 'Coin type');
    const accountIndex = wholeNumber(account, 0, 'Account');
    const parsed = parseRoot(rootKey);
    const network = testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
    const root = bip32.fromPrivateKey(parsed.privateKey, parsed.chainCode, network);
    const fingerprint = toHex(root.fingerprint);
    const accountPath = `m/${purpose}'/${coinType}'/${accountIndex}'`;
    const xpub = root.derivePath(accountPath).neutered().toBase58();
    const key = `[${fingerprint}/${purpose}h/${coinType}h/${accountIndex}h]${xpub}`;
    const make = (branch) => withChecksum(wrap(`${key}/${branch}/*`));
    return {
      fingerprint,
      accountPath,
      receive: make(0),
      change: make(1),
      combined: make('<0;1>'),
    };
  };

  // ---------------------------------------------------------------------
  // SeedQR (SeedSigner): Standard is the word indexes as a stream of
  // 4-digit numbers; Compact is the raw entropy bytes
  // ---------------------------------------------------------------------
  const wordlist = () => bip39.wordlists.english;
  const MNEMONIC_LENGTHS = [12, 15, 18, 21, 24];

  const mnemonicToSeedQrDigits = (mnemonic) =>
    mnemonic.trim().split(/\s+/).map((word) => {
      const index = wordlist().indexOf(word);
      if (index < 0) throw new Error(`"${word}" is not in the BIP39 English word list`);
      return String(index).padStart(4, '0');
    }).join('');

  const seedQrDigitsToMnemonic = (digits) => {
    if (!/^\d+$/.test(digits) || digits.length % 4 !== 0) {
      throw new Error('Not a SeedQR: expected a run of 4-digit word numbers');
    }
    const words = digits.match(/\d{4}/g).map((group) => {
      const index = Number(group);
      if (index > 2047) throw new Error(`${group} is not a BIP39 word number (0000 to 2047)`);
      return wordlist()[index];
    });
    if (!MNEMONIC_LENGTHS.includes(words.length)) {
      throw new Error(`A SeedQR holds 12 to 24 words, this one has ${words.length}`);
    }
    const mnemonic = words.join(' ');
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('The SeedQR words fail the BIP39 checksum');
    }
    return mnemonic;
  };

  const COMPACT_LENGTHS = [16, 20, 24, 28, 32];
  const isPrintable = (bytes) => Array.from(bytes).every((b) => b >= 0x20 && b <= 0x7e);

  const compactSeedQrToMnemonic = (bytes) => {
    if (!COMPACT_LENGTHS.includes(bytes.length)) {
      throw new Error(`A Compact SeedQR holds 16 to 32 bytes, this one has ${bytes.length}`);
    }
    return bip39.entropyToMnemonic(toHex(bytes));
  };

  // Work out whether a scanned QR code holds a seed, and in which format.
  // `text` is the decoded text and `bytes` the raw payload.
  const mnemonicFromQr = ({ text = '', bytes = [] }) => {
    const trimmed = text.trim();
    if (/^\d+$/.test(trimmed)) {
      return { format: 'SeedQR', mnemonic: seedQrDigitsToMnemonic(trimmed) };
    }
    // Plain text of that length (a word, a short note) is never read as
    // entropy; real Compact SeedQR bytes are almost never all printable.
    if (COMPACT_LENGTHS.includes(bytes.length) && !isPrintable(bytes)) {
      return { format: 'Compact SeedQR', mnemonic: compactSeedQrToMnemonic(bytes) };
    }
    const words = trimmed.toLowerCase().split(/\s+/);
    if (MNEMONIC_LENGTHS.includes(words.length) && bip39.validateMnemonic(words.join(' '))) {
      return { format: 'seed words', mnemonic: words.join(' ') };
    }
    throw new Error('This QR code does not hold a seed (SeedQR, Compact SeedQR or seed words).');
  };

  window.seedKeys = {
    bech32Encode,
    nostrKeys,
    nip06,
    bip85Nostr,
    descriptorChecksum,
    withChecksum,
    singleSigDescriptors,
    mnemonicToSeedQrDigits,
    seedQrDigitsToMnemonic,
    compactSeedQrToMnemonic,
    mnemonicFromQr,
  };
})();
