// Browser entry combining SLIP-39 (Trezor), SSKR (Blockchain Commons), and
// Foundation Shard (Passport Prime - wraps SSKR in foundation-api's
// backup-shard format) into a single global `window.shamir`.

const { Slip39 } = require('slip39-ts');
const { sskrGenerate, sskrCombine, Spec, GroupSpec, Secret } = require('@bcts/sskr');
const foundationShard = require('./_foundation_shard.js');

function hexToArray(hex) {
  if (typeof hex !== 'string') throw new Error('hex must be a string');
  if (!/^[0-9a-f]+$/i.test(hex)) throw new Error('Master secret must be hex');
  if (hex.length % 2 !== 0) throw new Error('Hex length must be even');
  const out = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

function hexToBytes(hex) { return new Uint8Array(hexToArray(hex)); }
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// =============================================================================
// SLIP-39 (Trezor / SatoshiLabs standard)
// =============================================================================
const slip39 = {
  /**
   * @param masterSecretHex Hex of 128- or 256-bit master secret
   * @param opts { groups: [[T,N,label?], ...], groupThreshold, passphrase }
   * @returns { groups: [[m1, m2, ...], ...] }
   */
  async generate(masterSecretHex, opts) {
    // NOTE: pass a plain Array (NOT Uint8Array) - see slip39-ts bug fix.
    const bytes = hexToArray(masterSecretHex);
    const groups = (opts.groups || []).map((g) => [g[0], g[1], g[2] || '']);
    const slip = await Slip39.fromArray(bytes, {
      groups,
      groupThreshold: opts.groupThreshold || 1,
      passphrase: opts.passphrase || '',
      iterationExponent: 0,
      title: 'seedtool SLIP-39 shares',
    });
    const out = [];
    for (const groupNode of slip.root.children || []) {
      const memberMnemonics = [];
      for (const member of groupNode.children || []) memberMnemonics.push(member.mnemonic);
      out.push(memberMnemonics);
    }
    return {
      groups: out,
      groupThreshold: opts.groupThreshold || 1,
      groupCount: groups.length,
      identifier: slip.identifier,
    };
  },

  async recover(mnemonics, passphrase) {
    const masterSecret = await Slip39.recoverSecret(mnemonics, passphrase || '');
    return Array.from(masterSecret).map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  validate(mnemonic) {
    try { return Slip39.validateMnemonic(mnemonic); } catch (_) { return false; }
  },
};

// =============================================================================
// SSKR (Blockchain Commons standard - used by Foundation Passport Prime)
// =============================================================================
//
// Shares are emitted as hex strings here. The Blockchain Commons "Bytewords"
// or UR-wrapped formats are output-formatting concerns - the canonical share
// payload is the byte string returned by sskrGenerate. Users transferring shares
// between SSKR-aware wallets can paste whichever encoding their wallet uses;
// the library's sskrCombine accepts the same raw bytes.

const sskr = {
  /**
   * Generate SSKR shares for a given master secret.
   *
   * @param masterSecretHex hex string (16 to 32 bytes, even length)
   * @param opts { groups: [[T,N,label?], ...], groupThreshold }
   * @returns { groups: [[shareHex, shareHex, ...], ...] }
   */
  generate(masterSecretHex, opts) {
    const data = hexToBytes(masterSecretHex);
    const secret = Secret.new(data);
    const groups = (opts.groups || []).map(([T, N]) => GroupSpec.new(T, N));
    const spec = Spec.new(opts.groupThreshold || 1, groups);
    const sharesByGroup = sskrGenerate(spec, secret); // Uint8Array[][]
    const groupsOut = sharesByGroup.map((groupShares) =>
      groupShares.map((shareBytes) => bytesToHex(shareBytes))
    );
    return { groups: groupsOut };
  },

  /**
   * Recover the master secret from SSKR share hexes.
   * @param shareHexes array of hex strings
   * @returns hex string of recovered secret
   */
  recover(shareHexes) {
    const shareBytes = shareHexes.map((h) => hexToBytes(h.replace(/\s+/g, '')));
    const recovered = sskrCombine(shareBytes);
    return bytesToHex(recovered.getData());
  },

  /**
   * Expose the raw library for advanced use.
   */
  lib: { sskrGenerate, sskrCombine, Spec, GroupSpec, Secret },
};

// =============================================================================
// Foundation Shard format - what Passport Prime's KeyOS actually writes to
// NFC KeyCards. Each share is an SSKR share wrapped in the foundation-api
// `backup-shard` dCBOR container (V1, with scheme metadata). Verified
// byte-exact against the upstream Rust crate's golden tests.
// =============================================================================
const foundation = {
  /**
   * Generate Foundation-format shares (Passport Prime compatible).
   * Each share is the dCBOR encoding of `backup_shard::Shard` containing
   * the SSKR bytes plus metadata (seed_fingerprint, scheme, etc.).
   *
   * NOTE on device_id and hmac: we set both to zero. Passport's secure
   * element signs the hmac using a key derived from the KeyCard UID, which
   * we can't reproduce in software. The output is structurally valid
   * Foundation Shard CBOR, useful for: previewing what Passport produces,
   * inspecting an exported share, and recovery (combine works regardless
   * of HMAC values since SSKR is the underlying secret-sharing layer).
   */
  generate(masterSecretHex, opts) {
    const sskrResult = sskr.generate(masterSecretHex, opts);
    // Compute seed_fingerprint = SHA-256(seedBytes || "Fingerprint")
    // For a BIP-39 mnemonic, the "seed" is the 64-byte PBKDF2 output. Here we
    // only have entropy (master secret); if the caller wants the same
    // fingerprint Passport computes, they should pass in the 64-byte seed.
    const seedFingerprint = opts.seedFingerprint || new Uint8Array(32);
    const deviceId = opts.deviceId || new Uint8Array(32);
    const timestamp = opts.timestamp || 0;
    const groupsHex = sskrResult.groups;
    // Flatten share index across all groups, mirroring how Passport indexes shares.
    const wrappedGroups = [];
    let globalIndex = 0;
    for (let g = 0; g < groupsHex.length; g++) {
      const wrappedGroup = [];
      for (let m = 0; m < groupsHex[g].length; m++) {
        const sskrShareBytes = foundationShard.fromHex(groupsHex[g][m]);
        const shardObj = {
          version: 1,
          deviceId,
          seedFingerprint,
          seedShamirShare: sskrShareBytes,
          seedShamirShareIndex: globalIndex,
          partOfMagicBackup: false,
          timestamp,
          schemeThreshold: (opts.groups && opts.groups[g] && opts.groups[g][0]) || 1,
          schemeShareCount: (opts.groups && opts.groups[g] && opts.groups[g][1]) || 1,
          hmac: new Uint8Array(32),
        };
        wrappedGroup.push(foundationShard.encodeHex(shardObj));
        globalIndex++;
      }
      wrappedGroups.push(wrappedGroup);
    }
    return { groups: wrappedGroups };
  },

  /**
   * Recover from a list of Foundation-format shares. Each share's CBOR is
   * decoded, the inner SSKR bytes extracted, then handed to sskrCombine.
   */
  recover(shardHexes) {
    const sskrHexes = shardHexes.map((shardHex) => {
      const decoded = foundationShard.decodeHex(shardHex.replace(/\s+/g, ''));
      return foundationShard.toHex(decoded.seedShamirShare);
    });
    return sskr.recover(sskrHexes);
  },

  /**
   * Decode a single Foundation Shard hex for inspection.
   */
  decode(shardHex) {
    return foundationShard.decodeHex(shardHex);
  },

  // Expose the low-level codec for advanced/testing use.
  lib: foundationShard,
};

// =============================================================================
// Public surface
// =============================================================================
const api = { slip39, sskr, foundation };
if (typeof window !== 'undefined') {
  window.shamir = api;
  // Back-compat: previous code expected window.slip39
  window.slip39 = slip39;
  // Also expose foundationShard for direct testing.
  window.foundationShard = foundationShard;
}
module.exports = api;
