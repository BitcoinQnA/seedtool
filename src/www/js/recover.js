/**
 * recover.js - Seed Phrase Recovery engine.
 *
 * Single public global: `window.seedRecover`.
 *
 * Search modes (combinable):
 *   - Per-word mark: clean / typo (Lev-1) / unknown (all 2048)
 *   - Order fixes:   adjacent swap / any-pair swap / reverse
 *   - Pre-processors: hex / binary / word-index / 4-letter abbreviations
 *   - Wordlist:      detect or pick one of the 10 BIP-39 languages
 *   - Address:       optional constraint - derive addresses from each candidate
 *                    seed (+ optional BIP-39 passphrase) and look for a match.
 *
 * Cooperatively yields to the event loop every YIELD_EVERY iterations so the
 * UI stays responsive during long searches.
 */
(function () {
  'use strict';

  const YIELD_EVERY = 256; // candidates per microtask batch

  // BIP-39 wordlists are already loaded via js/lib/bip39.js
  const WORDLISTS = (window.bip39 && window.bip39.wordlists) || {};
  const DEFAULT_LANGUAGE = 'english';

  // Standard derivation paths to scan when an address constraint is provided.
  // Each entry maps a parent path and the address types it can produce.
  const DERIVATION_PATHS = [
    { path: "m/84'/0'/0'/0", addressType: 'p2wpkh' }, // BIP-84 native segwit (bc1q…)
    { path: "m/86'/0'/0'/0", addressType: 'p2tr'   }, // BIP-86 taproot (bc1p…)
    { path: "m/49'/0'/0'/0", addressType: 'p2sh-p2wpkh' }, // BIP-49 nested segwit (3…)
    { path: "m/44'/0'/0'/0", addressType: 'p2pkh'  }, // BIP-44 legacy (1…)
    // Some wallets used these alternates historically:
    { path: "m/0'/0",        addressType: 'p2wpkh' }, // Sparrow/Electrum simple
    { path: "m/0/0",         addressType: 'p2pkh'  },
  ];

  // ----- Levenshtein distance (≤2 only, for speed) --------------------------
  // Truncated Wagner–Fischer: returns >limit early.
  function levenshtein(a, b, limit) {
    if (a === b) return 0;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > limit) return limit + 1;
    let prev = new Array(lb + 1);
    let curr = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) prev[j] = j;
    for (let i = 1; i <= la; i++) {
      curr[0] = i;
      let rowMin = curr[0];
      for (let j = 1; j <= lb; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        if (curr[j] < rowMin) rowMin = curr[j];
      }
      if (rowMin > limit) return limit + 1;
      const tmp = prev; prev = curr; curr = tmp;
    }
    return prev[lb];
  }

  // ----- Language detection -------------------------------------------------
  function detectLanguage(words) {
    if (!words || !words.length) return null;
    let best = null;
    let bestScore = 0;
    for (const lang of Object.keys(WORDLISTS)) {
      const list = WORDLISTS[lang];
      let score = 0;
      for (const w of words) {
        if (!w) continue;
        if (list.includes(w)) score++;
      }
      if (score > bestScore) { bestScore = score; best = lang; }
    }
    // Require at least half the words to match; otherwise we don't know.
    if (best && bestScore >= Math.ceil(words.filter(Boolean).length / 2)) return best;
    return null;
  }

  // ----- Encoding-mode pre-processors --------------------------------------
  function hexToBytes(hex) {
    hex = hex.replace(/[\s\-_]+/g, '').toLowerCase();
    if (!/^[0-9a-f]+$/.test(hex)) throw new Error('Hex contains non-hex characters');
    if (hex.length % 2) throw new Error('Hex length must be even');
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    return out;
  }

  function bytesToHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function hexToWords(hex, language = DEFAULT_LANGUAGE) {
    const bytes = hexToBytes(hex);
    const validLengths = [16, 20, 24, 28, 32];
    if (!validLengths.includes(bytes.length)) {
      throw new Error(`Entropy must be 16/20/24/28/32 bytes (got ${bytes.length})`);
    }
    return window.bip39.entropyToMnemonic(bytesToHex(bytes), WORDLISTS[language]).split(' ');
  }

  function binaryToWords(binary, language = DEFAULT_LANGUAGE) {
    const bits = binary.replace(/[^01]/g, '');
    const validBitLengths = [128, 160, 192, 224, 256];
    if (!validBitLengths.includes(bits.length)) {
      throw new Error(`Binary must be 128/160/192/224/256 bits (got ${bits.length})`);
    }
    let hex = '';
    for (let i = 0; i < bits.length; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hexToWords(hex, language);
  }

  function indexesToWords(input, language = DEFAULT_LANGUAGE) {
    const list = WORDLISTS[language];
    if (!list) throw new Error('Unknown language: ' + language);
    const indexes = input.split(/[\s,;]+/).filter(Boolean).map((s) => parseInt(s, 10));
    if (indexes.some(isNaN)) throw new Error('Indexes must be numbers');
    if (![12, 15, 18, 21, 24].includes(indexes.length)) {
      throw new Error(`Expected 12/15/18/21/24 indexes (got ${indexes.length})`);
    }
    return indexes.map((i) => {
      if (i < 0 || i >= list.length) throw new Error(`Index ${i} out of range`);
      return list[i];
    });
  }

  // ----- 4-letter abbreviation expansion -----------------------------------
  // BIP-39 wordlists are designed so the first 4 letters uniquely identify each
  // word (with one exception in Japanese, which we don't bother with here).
  function expandAbbreviations(words, language = DEFAULT_LANGUAGE) {
    const list = WORDLISTS[language];
    if (!list) throw new Error('Unknown language: ' + language);
    return words.map((w) => {
      if (!w) return w;
      if (list.includes(w)) return w;
      if (w.length >= 4) {
        const matches = list.filter((wl) => wl.startsWith(w));
        if (matches.length === 1) return matches[0];
      }
      return w; // leave it for the search to find
    });
  }

  // ----- Mnemonic checksum validation --------------------------------------
  function isValidMnemonic(words, language = DEFAULT_LANGUAGE) {
    if (!window.bip39) return false;
    try {
      const list = WORDLISTS[language];
      return window.bip39.validateMnemonic(words.join(' '), list);
    } catch (_) {
      return false;
    }
  }

  // ----- Address-constrained check -----------------------------------------
  // For a given mnemonic candidate, try standard derivation paths up to a small
  // gap limit and see if any produces the expected address.
  function paymentFor(addressType, pubkey, network) {
    const btc = window.bitcoin;
    const isTestnet = network && network.bech32 && network.bech32.startsWith('t');
    switch (addressType) {
      case 'p2pkh':       return btc.payments.p2pkh({ pubkey, network });
      case 'p2sh-p2wpkh': return btc.payments.p2sh({ redeem: btc.payments.p2wpkh({ pubkey, network }), network });
      case 'p2wpkh':      return btc.payments.p2wpkh({ pubkey, network });
      case 'p2tr':
        // The bundled bitcoinjs-lib predates p2tr; use the bip86 helper that dom.js uses.
        if (window.bip86 && typeof window.bip86.getP2TRAddress === 'function') {
          try { return { address: window.bip86.getP2TRAddress(pubkey, isTestnet) }; }
          catch (_) { return null; }
        }
        if (btc.payments.p2tr) return btc.payments.p2tr({ internalPubkey: pubkey.slice(1, 33), network });
        return null;
    }
    return null;
  }

  function relevantPathsForAddress(address) {
    // Narrow the derivation-path search by the address's surface format.
    if (!address) return DERIVATION_PATHS;
    if (address.startsWith('bc1p') || address.startsWith('tb1p')) return DERIVATION_PATHS.filter((p) => p.addressType === 'p2tr');
    if (address.startsWith('bc1q') || address.startsWith('tb1q') || address.startsWith('bc1') || address.startsWith('tb1'))
      return DERIVATION_PATHS.filter((p) => p.addressType === 'p2wpkh');
    if (address.startsWith('3') || address.startsWith('2')) return DERIVATION_PATHS.filter((p) => p.addressType === 'p2sh-p2wpkh');
    if (address.startsWith('1') || address.startsWith('m') || address.startsWith('n')) return DERIVATION_PATHS.filter((p) => p.addressType === 'p2pkh');
    return DERIVATION_PATHS;
  }

  function checkAddressMatch(words, expectedAddress, options = {}) {
    if (!window.bip39 || !window.bip32 || !window.bitcoin) return { match: false };
    const passphrase = options.passphrase || '';
    const gapLimit = options.gapLimit || 5;
    const language = options.language || DEFAULT_LANGUAGE;
    const network = window.bitcoin.networks.bitcoin;
    const seed = window.bip39.mnemonicToSeedSync(words.join(' '), passphrase);
    const root = window.bip32.fromSeed(seed, network);
    const paths = relevantPathsForAddress(expectedAddress);
    for (const { path, addressType } of paths) {
      for (let change = 0; change <= 1; change++) {
        for (let i = 0; i < gapLimit; i++) {
          const node = root.derivePath(`${path.replace(/\/0$/, '/' + change)}/${i}`);
          const payment = paymentFor(addressType, node.publicKey, network);
          if (payment && payment.address === expectedAddress) {
            return { match: true, path: `${path.replace(/\/0$/, '/' + change)}/${i}`, addressType };
          }
        }
      }
    }
    void language; // language is implicit in the seed bytes
    return { match: false };
  }

  // ----- Candidate generators ----------------------------------------------
  // Each generator yields full mnemonic candidates (string[]).
  // Order-mode generators take a base words array; word-level expansion is applied
  // to the result.

  function* enumerateOrderVariants(words, modes) {
    yield words; // identity (always tried)
    if (modes.reverse) {
      const rev = words.slice().reverse();
      if (!arraysEqual(rev, words)) yield rev;
    }
    if (modes.adjacentSwap) {
      for (let i = 0; i < words.length - 1; i++) {
        const c = words.slice();
        [c[i], c[i + 1]] = [c[i + 1], c[i]];
        yield c;
      }
    }
    if (modes.anySwap) {
      for (let i = 0; i < words.length - 1; i++) {
        for (let j = i + 2; j < words.length; j++) { // skip adjacent (already done)
          const c = words.slice();
          [c[i], c[j]] = [c[j], c[i]];
          yield c;
        }
      }
    }
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // Build the per-position candidate pool array.
  function candidatePoolsForWords(words, wordMarks, language) {
    const list = WORDLISTS[language];
    if (!list) throw new Error('Unknown language: ' + language);
    return words.map((w, i) => {
      const mark = wordMarks[i] || 'clean';
      if (mark === 'unknown') return list.slice(); // try everything
      if (mark === 'typo') {
        // Levenshtein-1 neighbors (limit 2 for safety)
        const lower = (w || '').toLowerCase();
        return list.filter((wl) => levenshtein(wl, lower, 1) <= 1);
      }
      // clean - if it's exactly in the wordlist, just that; otherwise fall back to Lev-1.
      const lower = (w || '').toLowerCase();
      if (list.includes(lower)) return [lower];
      // Not a valid word; attempt a tolerant typo search anyway so the user doesn't get nothing.
      return list.filter((wl) => levenshtein(wl, lower, 1) <= 1);
    });
  }

  // Cartesian product iterator over candidate pools.
  function totalCombinations(pools) {
    let total = 1;
    for (const p of pools) { total *= Math.max(1, p.length); if (total > 1e9) return Infinity; }
    return total;
  }

  function* cartesian(pools) {
    const n = pools.length;
    const indexes = new Array(n).fill(0);
    const lengths = pools.map((p) => Math.max(1, p.length));
    if (lengths.some((l) => l === 0)) return;
    const out = new Array(n);
    while (true) {
      for (let i = 0; i < n; i++) out[i] = pools[i][indexes[i]] || '';
      yield out.slice();
      // increment
      let i = n - 1;
      while (i >= 0) {
        indexes[i]++;
        if (indexes[i] < lengths[i]) break;
        indexes[i] = 0;
        i--;
      }
      if (i < 0) return;
    }
  }

  // ----- Main search -------------------------------------------------------
  async function search(input, onProgress) {
    const t0 = Date.now();
    const {
      words = [],
      wordMarks = [],
      language = DEFAULT_LANGUAGE,
      orderModes = {},
      passphrase = '',
      addressConstraint = '',
      expandAbbrevs = true,
      maxMatches = 50,
      stopOnFirstAddressMatch = true,
    } = input;

    if (![12, 15, 18, 21, 24].includes(words.length)) {
      throw new Error(`Word count must be 12, 15, 18, 21, or 24 (got ${words.length}).`);
    }

    const list = WORDLISTS[language];
    if (!list) throw new Error('Unknown language: ' + language);

    // 1. Apply abbreviation expansion if asked
    let baseWords = words.slice();
    if (expandAbbrevs) baseWords = expandAbbreviations(baseWords, language);

    // 2. Enumerate order-variants up front (12-word: max ~78 variants)
    const orderVariants = Array.from(enumerateOrderVariants(baseWords, orderModes));

    // 3. For each order variant, compute its candidate pools and total
    const plans = orderVariants.map((variant) => {
      const pools = candidatePoolsForWords(variant, wordMarks, language);
      const total = totalCombinations(pools);
      return { variant, pools, total };
    });

    const grandTotal = plans.reduce((acc, p) => acc + (Number.isFinite(p.total) ? p.total : 0), 0);
    let tested = 0;
    const matches = [];

    // 4. Iterate
    for (const { pools } of plans) {
      const iter = cartesian(pools);
      for (const candidate of iter) {
        tested++;

        const valid = isValidMnemonic(candidate, language);
        if (valid) {
          if (addressConstraint) {
            const m = checkAddressMatch(candidate, addressConstraint, { passphrase, language });
            if (m.match) {
              matches.push({ words: candidate, addressMatch: true, ...m });
              if (stopOnFirstAddressMatch) {
                if (onProgress) onProgress({ tested, total: grandTotal, elapsed: Date.now() - t0, matches: matches.length, done: true });
                return { matches, stats: { tested, total: grandTotal, elapsed: Date.now() - t0, stoppedEarly: true } };
              }
            }
          } else {
            matches.push({ words: candidate, addressMatch: false });
          }
          if (matches.length >= maxMatches) {
            if (onProgress) onProgress({ tested, total: grandTotal, elapsed: Date.now() - t0, matches: matches.length, done: true });
            return { matches, stats: { tested, total: grandTotal, elapsed: Date.now() - t0, stoppedEarly: true } };
          }
        }

        if (tested % YIELD_EVERY === 0) {
          if (onProgress) {
            const cont = onProgress({ tested, total: grandTotal, elapsed: Date.now() - t0, matches: matches.length, done: false });
            if (cont === false) {
              return { matches, stats: { tested, total: grandTotal, elapsed: Date.now() - t0, stoppedEarly: true, cancelled: true } };
            }
          }
          // Yield to the event loop so the UI can paint.
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    }

    if (onProgress) onProgress({ tested, total: grandTotal, elapsed: Date.now() - t0, matches: matches.length, done: true });
    return { matches, stats: { tested, total: grandTotal, elapsed: Date.now() - t0, stoppedEarly: false } };
  }

  // ----- Public surface -----------------------------------------------------
  window.seedRecover = {
    WORDLISTS,
    DEFAULT_LANGUAGE,
    detectLanguage,
    hexToWords,
    binaryToWords,
    indexesToWords,
    expandAbbreviations,
    isValidMnemonic,
    checkAddressMatch,
    search,
    // Exposed for testing / advanced use
    _levenshtein: levenshtein,
  };
})();
