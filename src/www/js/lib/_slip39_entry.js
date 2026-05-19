// Browser entry for slip39-ts. Bundled via esbuild + node-polyfill into js/lib/slip39.js
// Exposes window.slip39.

const { Slip39 } = require('slip39-ts');

const api = {
  Slip39,

  /**
   * Generate SLIP-39 shares.
   *
   * @param masterSecretHex Hex string of the master secret (BIP-39 entropy or arbitrary 128/256-bit secret)
   * @param opts            { groups: [[T,N,label?], ...], groupThreshold, passphrase, iterationExponent, title }
   * @returns               Array of shares - for a single-group basic config, each share is a string of words.
   *                        For multi-group, returns nested groups: [ [share1, share2, ...], [...], ... ]
   */
  async generate(masterSecretHex, opts) {
    if (typeof masterSecretHex !== 'string') throw new Error('masterSecretHex must be a hex string');
    if (!/^[0-9a-f]+$/i.test(masterSecretHex)) throw new Error('Master secret must be hex');
    if (masterSecretHex.length % 2 !== 0) throw new Error('Hex length must be even');
    // NOTE: use a plain Array, NOT Uint8Array. slip39-ts internally calls
    // `salt.concat(secret)` which silently mis-handles Uint8Array (appending it
    // as a single element instead of unpacking), breaking the encrypt round trip.
    const bytes = [];
    for (let i = 0; i < masterSecretHex.length; i += 2) {
      bytes.push(parseInt(masterSecretHex.slice(i, i + 2), 16));
    }
    const groups = (opts.groups || []).map((g) => [g[0], g[1], g[2] || '']);
    const slip = await Slip39.fromArray(bytes, {
      groups,
      groupThreshold: opts.groupThreshold || 1,
      passphrase: opts.passphrase || '',
      iterationExponent: opts.iterationExponent || 0,
      title: opts.title || 'seedtool SLIP-39 shares',
    });
    // Drill into the share tree. The root has one child per group (groups.length).
    // Each group has one child per member (group[1]).
    const out = [];
    const root = slip.root;
    for (let gi = 0; gi < (root.children || []).length; gi++) {
      const groupNode = root.children[gi];
      const memberMnemonics = [];
      for (const member of groupNode.children || []) {
        memberMnemonics.push(member.mnemonic);
      }
      out.push(memberMnemonics);
    }
    return {
      groups: out,                  // [[m1, m2, ...], [m1, m2, ...], ...]
      groupThreshold: opts.groupThreshold || 1,
      groupCount: groups.length,
      identifier: slip.identifier,
    };
  },

  /**
   * Recover the master secret from a set of SLIP-39 share mnemonics.
   * @param mnemonics Array of strings, each a space-separated SLIP-39 share
   * @param passphrase Optional passphrase
   * @returns Hex string of the master secret
   */
  async recover(mnemonics, passphrase) {
    const masterSecret = await Slip39.recoverSecret(mnemonics, passphrase || '');
    return Array.from(masterSecret).map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Validate a single SLIP-39 share's checksum + structure (does NOT validate it
   * belongs to the same set as other shares - that's checked at recover time).
   */
  validate(mnemonic) {
    try {
      return Slip39.validateMnemonic(mnemonic);
    } catch (e) {
      return false;
    }
  },
};

if (typeof window !== 'undefined') window.slip39 = api;
module.exports = api;
