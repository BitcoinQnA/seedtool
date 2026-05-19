/**
 * shell.js - front-end shell for the new home grid / tool view layout.
 *
 * Responsibilities (none of these touch tool logic in dom.js):
 *   1. Hash router         - show one view at a time based on location.hash
 *   2. Seed bar            - sticky bar showing loaded-seed state (polls #bip32RootKey)
 *   3. Card lock           - grey out seed-required cards until a seed is loaded
 *   4. Tool search         - filter cards on the home grid
 *   5. Subtabs             - BIP85 entropy/passwords switch
 *   6. Keyboard            - '/' focuses search, Esc clears
 *   7. Explainer dismiss   - beginner callouts can be permanently dismissed per-tool
 *   8. Passphrase mirror   - passgen tool view shows live #bip39Passphrase value
 *   9. Clear-seed flow     - topbar action + confirm modal
 *  10. Force textarea size - dom.js's textareaResize can set height: 5px when its
 *                            target is in a display:none view. We re-run it whenever
 *                            a view becomes visible.
 */
(function () {
  'use strict';

  const ROUTES = new Set([
    'home', 'seed', 'derived', 'bip47', 'multisig', 'bip85',
    'passgen', 'passtest', 'split', 'xor', 'otp', 'lastword',
    'single', 'message', 'learn', 'tour', 'recover', 'silent',
    'shamir', 'slip39', // slip39 kept as alias for back-compat
    'labels', 'lightning', 'miniscript', 'psbt', 'bip353',
    'about', 'credits',
  ]);

  const LS_DISMISSED = 'seedtool:dismissed-explainers';

  // ----- Router --------------------------------------------------------------
  function parseHash() {
    const raw = (location.hash || '').replace(/^#\/?/, '').trim();
    if (!raw) return 'home';
    return ROUTES.has(raw) ? raw : 'home';
  }

  function refreshTextareaSizes() {
    // dom.js's textareaResize is debounced. After a view becomes visible we
    // need to re-run it so textareas that had scrollHeight=0 while hidden
    // get a proper height. We also clear the inline style to let the new
    // measurement take precedence over a stale 5px value.
    document.querySelectorAll('.view:not([hidden]) textarea').forEach((t) => {
      t.style.height = '';
    });
    if (typeof window.adjustPanelHeight === 'function') {
      window.adjustPanelHeight();
      // Second pass after layout settles - adjustPanelHeight is debounced 50ms
      // and the first call can fire before the just-shown view has been painted.
      setTimeout(() => window.adjustPanelHeight && window.adjustPanelHeight(), 80);
    }
  }

  function applyRoute() {
    let route = parseHash();
    // Back-compat: route /slip39 → /shamir (which has the merged SLIP-39 + SSKR tool)
    if (route === 'slip39') route = 'shamir';
    const isHome = route === 'home';
    document.body.dataset.route = route;

    // Home view
    const home = document.querySelector('.view--home');
    if (home) home.hidden = !isHome;

    // Tool views
    document.querySelectorAll('.view--tool').forEach((view) => {
      const match = view.dataset.tool === route;
      view.hidden = !match;
      if (match) {
        const accordion = view.querySelector('.accordion');
        if (accordion && !accordion.classList.contains('accordion--active')) {
          accordion.classList.add('accordion--active');
          const panel = accordion.nextElementSibling;
          if (panel) panel.classList.add('accordion-panel--active');
        }
      }
    });

    refreshTextareaSizes();

    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

    if (isHome && lastSearchValue) applySearch(lastSearchValue);
  }

  window.addEventListener('hashchange', applyRoute);

  // ----- Seed status (now lives inside the topbar) --------------------------
  const topbarSeed = document.getElementById('topbarSeed');
  const topbarTitle = document.getElementById('topbarTitle');
  const seedbarFingerprint = document.getElementById('seedbarFingerprint');
  const seedbarWords = document.getElementById('seedbarWords');
  const passgenOutput = document.getElementById('passgenOutput');

  let lastRootKey = '';
  let lastPassphrase = '';
  let seedLoaded = false;

  function truncateMnemonic(words) {
    if (!words) return '-';
    const parts = words.trim().split(/\s+/);
    if (parts.length <= 4) return parts.join(' ');
    return `${parts[0]} ${parts[1]} … ${parts[parts.length - 1]} (${parts.length})`;
  }

  function refreshPassgenMirror() {
    if (!passgenOutput) return;
    const value = (document.getElementById('bip39Passphrase') || {}).value || '';
    if (value === lastPassphrase) return;
    lastPassphrase = value;
    if (value) {
      passgenOutput.textContent = value;
      passgenOutput.classList.remove('is-empty');
    } else {
      passgenOutput.textContent = 'Roll some dice or click "Add word" to start…';
      passgenOutput.classList.add('is-empty');
    }
  }

  let lastFingerprint = '';

  function flashElement(el) {
    if (!el) return;
    el.classList.remove('is-flash');
    // Force reflow so the animation can replay
    void el.offsetWidth;
    el.classList.add('is-flash');
    setTimeout(() => el.classList.remove('is-flash'), 1200);
  }

  function refreshSeedBar() {
    const rootKey = (document.getElementById('bip32RootKey') || {}).value || '';
    refreshPassgenMirror();
    if (rootKey === lastRootKey) return;
    lastRootKey = rootKey;
    const present = rootKey.length > 0;
    seedLoaded = present;

    if (topbarSeed) topbarSeed.hidden = !present;
    if (topbarTitle) topbarTitle.hidden = present;
    if (present) {
      const fp = (document.getElementById('bip32RootFingerprint') || {}).value || '';
      const phrase = (document.getElementById('bip39Phrase') || {}).value || '';
      if (seedbarFingerprint) seedbarFingerprint.textContent = fp || '-';
      if (seedbarWords) seedbarWords.textContent = truncateMnemonic(phrase);
      // Flash the fingerprint when it changes from one non-empty value to another.
      // Skip the initial render (empty -> first fingerprint).
      if (fp && lastFingerprint && fp !== lastFingerprint) {
        flashElement(seedbarFingerprint);
        flashElement(document.getElementById('seedHeroAddressValue'));
        flashElement(document.getElementById('seedHeroQr'));
        const rootFpField = document.getElementById('bip32RootFingerprint');
        if (rootFpField) {
          rootFpField.classList.add('is-flash--field');
          setTimeout(() => rootFpField.classList.remove('is-flash--field'), 1200);
        }
      }
      lastFingerprint = fp;
    } else {
      lastFingerprint = '';
    }
    refreshLockState();
    // Notify any features that listen for seed changes (message tool, walkthrough)
    document.dispatchEvent(new CustomEvent('seedtool:seed-changed', { detail: { present } }));
    updateWalkthroughBindings();
  }

  setInterval(refreshSeedBar, 700);

  // ----- Card lock state -----------------------------------------------------
  function refreshLockState() {
    document.querySelectorAll('.card[data-requires-seed]').forEach((card) => {
      card.classList.toggle('card--locked', !seedLoaded);
    });
    document.querySelectorAll('[data-seed-empty]').forEach((el) => {
      el.hidden = seedLoaded;
    });
  }

  // ----- "Needs a seed" modal (shown when a locked card is tapped) -----------
  const needSeedModal      = document.getElementById('needSeedConfirm');
  const needSeedToolName   = document.getElementById('needSeedToolName');
  const needSeedCancel     = document.getElementById('needSeedCancel');
  const needSeedGoToSeed   = document.getElementById('needSeedGoToSeed');
  const needSeedQuickGen   = document.getElementById('needSeedQuickGen');
  let pendingLockedRoute = null;

  function openNeedSeedModal(targetHash, toolLabel) {
    if (!needSeedModal) { location.hash = '#/seed'; return; }
    pendingLockedRoute = targetHash || null;
    if (needSeedToolName) needSeedToolName.textContent = toolLabel || 'This tool';
    needSeedModal.classList.add('is-open');
  }
  function closeNeedSeedModal() {
    if (needSeedModal) needSeedModal.classList.remove('is-open');
  }

  document.addEventListener('click', (event) => {
    const card = event.target.closest('.card[data-requires-seed]');
    if (!card) return;
    if (card.classList.contains('card--locked')) {
      event.preventDefault();
      const targetHash = card.getAttribute('href') || null;
      const titleEl = card.querySelector('.card__title');
      const label = titleEl ? titleEl.textContent.trim() : 'This tool';
      openNeedSeedModal(targetHash, label);
    }
  });

  if (needSeedCancel) needSeedCancel.addEventListener('click', () => {
    pendingLockedRoute = null;
    closeNeedSeedModal();
  });
  if (needSeedGoToSeed) needSeedGoToSeed.addEventListener('click', () => {
    pendingLockedRoute = null;
    closeNeedSeedModal();
    location.hash = '#/seed';
  });
  if (needSeedQuickGen) needSeedQuickGen.addEventListener('click', () => {
    const target = pendingLockedRoute;
    pendingLockedRoute = null;
    closeNeedSeedModal();
    // Trigger the existing GENERATE button in the seed workspace.
    const genBtn = document.querySelector('.btn.generate');
    if (genBtn) genBtn.click();
    // The derivation chain is async — poll for the root key to appear, then
    // refresh the seedbar (so lock badges clear) and follow the original route.
    const start = Date.now();
    const poll = setInterval(() => {
      const rootKey = (document.getElementById('bip32RootKey') || {}).value || '';
      const ready = rootKey.length > 0;
      const timedOut = Date.now() - start > 4000;
      if (ready || timedOut) {
        clearInterval(poll);
        lastRootKey = 'force-refresh';
        refreshSeedBar();
        if (target) location.hash = target;
      }
    }, 80);
  });
  if (needSeedModal) {
    needSeedModal.addEventListener('click', (e) => {
      if (e.target === needSeedModal) {
        pendingLockedRoute = null;
        closeNeedSeedModal();
      }
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && needSeedModal && needSeedModal.classList.contains('is-open')) {
      pendingLockedRoute = null;
      closeNeedSeedModal();
    }
  });

  // ----- Clear seed flow -----------------------------------------------------
  const clearSeedBtn = document.getElementById('clearSeedBtn');
  const clearSeedConfirm = document.getElementById('clearSeedConfirm');
  const clearSeedCancel = document.getElementById('clearSeedCancel');
  const clearSeedConfirmBtn = document.getElementById('clearSeedConfirmBtn');

  function openClearSeedModal() {
    if (clearSeedConfirm) clearSeedConfirm.classList.add('is-open');
  }
  function closeClearSeedModal() {
    if (clearSeedConfirm) clearSeedConfirm.classList.remove('is-open');
  }
  function performClearSeed() {
    // Clear all primary seed fields, then trigger dom.js's existing recompute
    // chain via an input event on the BIP39 phrase textarea (empty value =
    // mnemonicToSeedPopulate clears the rest, see dom.js resetEverything()).
    const ids = ['bip39Phrase', 'bip39Passphrase', 'entropy', 'bip32RootKey', 'bip32RootFingerprint', 'bip32RootWif', 'bip39Seed'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    // Trigger recompute chain
    const phrase = document.getElementById('bip39Phrase');
    if (phrase) phrase.dispatchEvent(new Event('input', { bubbles: true }));
    closeClearSeedModal();
    // Force seed bar refresh quickly
    lastRootKey = 'force-refresh';
    refreshSeedBar();
  }

  if (clearSeedBtn) clearSeedBtn.addEventListener('click', openClearSeedModal);
  if (clearSeedCancel) clearSeedCancel.addEventListener('click', closeClearSeedModal);
  if (clearSeedConfirmBtn) clearSeedConfirmBtn.addEventListener('click', performClearSeed);
  if (clearSeedConfirm) {
    clearSeedConfirm.addEventListener('click', (e) => {
      if (e.target === clearSeedConfirm) closeClearSeedModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && clearSeedConfirm && clearSeedConfirm.classList.contains('is-open')) {
      closeClearSeedModal();
    }
  });

  // ----- Online-detected banner ----------------------------------------------
  // navigator.onLine is unreliable on Tor / hardened browsers (always reports
  // true for fingerprint resistance). The banner copy explicitly calls this
  // out and is dismissible per-session so a Tor user can ack it once.
  const onlineBanner = document.getElementById('onlineBanner');
  const onlineBannerDismiss = document.getElementById('onlineBannerDismiss');
  const ONLINE_BANNER_KEY = 'seedtool:online-banner-dismissed';
  let onlineBannerDismissed = false;
  try { onlineBannerDismissed = sessionStorage.getItem(ONLINE_BANNER_KEY) === '1'; } catch (_) {}

  function syncOnlineBanner() {
    if (!onlineBanner) return;
    const online = !!(window.navigator && window.navigator.onLine);
    if (online && !onlineBannerDismissed) onlineBanner.hidden = false;
    else onlineBanner.hidden = true;
  }
  if (onlineBannerDismiss) {
    onlineBannerDismiss.addEventListener('click', () => {
      onlineBannerDismissed = true;
      try { sessionStorage.setItem(ONLINE_BANNER_KEY, '1'); } catch (_) {}
      if (onlineBanner) onlineBanner.hidden = true;
    });
  }
  window.addEventListener('online', syncOnlineBanner);
  window.addEventListener('offline', syncOnlineBanner);
  syncOnlineBanner();

  // ----- Tool search ---------------------------------------------------------
  const searchInput = document.getElementById('toolSearch');
  let lastSearchValue = '';

  function applySearch(value) {
    lastSearchValue = value;
    const q = value.trim().toLowerCase();
    document.querySelectorAll('.view--home .card').forEach((card) => {
      if (!q) {
        card.hidden = false;
        return;
      }
      const title = (card.querySelector('.card__title') || {}).textContent || '';
      const desc = (card.querySelector('.card__desc') || {}).textContent || '';
      const keywords = card.dataset.keywords || '';
      const hay = (title + ' ' + desc + ' ' + keywords).toLowerCase();
      card.hidden = !hay.includes(q);
    });
    document.querySelectorAll('.view--home .home__group').forEach((group) => {
      const visible = group.querySelectorAll('.card:not([hidden])').length;
      group.classList.toggle('is-empty', q.length > 0 && visible === 0);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => applySearch(e.target.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        applySearch('');
        searchInput.blur();
      }
    });
  }

  // ----- Keyboard shortcuts --------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (parseHash() !== 'home' || !searchInput) return;
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  });

  // ----- BIP85 subtabs -------------------------------------------------------
  document.querySelectorAll('.subtabs').forEach((bar) => {
    const tabs = bar.querySelectorAll('.subtabs__tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.subtab;
        tabs.forEach((t) => t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));
        const parentView = bar.closest('.view--tool');
        if (!parentView) return;
        parentView.querySelectorAll('.subtabs__panel').forEach((panel) => {
          panel.hidden = panel.dataset.subtabPanel !== target;
        });
        refreshTextareaSizes();
      });
    });
  });

  // ----- Explainer dismiss persistence --------------------------------------
  function loadDismissed() {
    try {
      return new Set(JSON.parse(localStorage.getItem(LS_DISMISSED) || '[]'));
    } catch (_) {
      return new Set();
    }
  }
  function saveDismissed(set) {
    try {
      localStorage.setItem(LS_DISMISSED, JSON.stringify(Array.from(set)));
    } catch (_) { /* no-op */ }
  }
  function applyDismissed() {
    const dismissed = loadDismissed();
    document.querySelectorAll('.explainer[data-explainer]').forEach((el) => {
      if (dismissed.has(el.dataset.explainer)) {
        el.hidden = true;
      }
    });
  }
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-dismiss-explainer]');
    if (!btn) return;
    const key = btn.dataset.dismissExplainer;
    const explainer = btn.closest('.explainer');
    if (explainer) explainer.hidden = true;
    const dismissed = loadDismissed();
    dismissed.add(key);
    saveDismissed(dismissed);
  });

  // ----- Sign / Verify Message (BIP-137 + BIP-322) --------------------------
  //
  // bitcoinjs-message lives at window.messageSigning.bip137 (sign/verify/magicHash).
  // bip322-js lives at  window.messageSigning.bip322 (sign/verify).
  //
  // For the SIGN flow we either derive a private key from the loaded seed at the
  // user-supplied path, or accept a pasted WIF. We never log either anywhere.
  // For VERIFY we just try both BIPs - if either accepts the signature, it's valid.

  function getMessageLib() {
    return window.messageSigning || null;
  }

  // Address detection for auto-select between BIP-137 and BIP-322.
  // - bc1q… → P2WPKH (SegWit v0)         → BIP-322
  // - bc1p… → P2TR (Taproot)             → BIP-322 ONLY
  // - 3…    → P2SH-P2WPKH or P2SH        → either (BIP-322 preferred)
  // - 1…    → P2PKH                      → BIP-137 (BIP-322 also works)
  function detectAddressType(addr) {
    if (!addr) return null;
    if (addr.startsWith('bc1p') || addr.startsWith('tb1p')) return 'p2tr';
    if (addr.startsWith('bc1q') || addr.startsWith('tb1q') || addr.startsWith('bc1') || addr.startsWith('tb1')) return 'p2wpkh';
    if (addr.startsWith('3') || addr.startsWith('2')) return 'p2sh';
    if (addr.startsWith('1') || addr.startsWith('m') || addr.startsWith('n')) return 'p2pkh';
    return null;
  }

  function pickStandardForAddress(addr, requested) {
    if (requested && requested !== 'auto') return requested;
    const t = detectAddressType(addr);
    if (t === 'p2pkh') return 'bip137';
    return 'bip322';
  }

  // Derive a node from the BIP32 root xprv at a given path. Returns { node, network }
  function deriveNodeFromRoot(path) {
    const rootXprv = (document.getElementById('bip32RootKey') || {}).value || '';
    if (!rootXprv) throw new Error('No seed is loaded. Load a seed first from the Seed Workspace.');
    if (!window.bip32) throw new Error('BIP32 library not loaded.');
    const network = (window.bitcoin && window.bitcoin.networks && window.bitcoin.networks.bitcoin) || undefined;
    const root = window.bip32.fromBase58(rootXprv, network);
    const node = root.derivePath(path);
    return { node, network };
  }

  function paymentForKeyAndAddrType(pubkey, addrType, network) {
    const btc = window.bitcoin;
    if (!btc) throw new Error('bitcoinjs-lib not loaded');
    switch (addrType) {
      case 'p2pkh':       return btc.payments.p2pkh({ pubkey, network });
      case 'p2sh-p2wpkh': return btc.payments.p2sh({ redeem: btc.payments.p2wpkh({ pubkey, network }), network });
      case 'p2wpkh':      return btc.payments.p2wpkh({ pubkey, network });
      case 'p2tr':        // bitcoinjs-lib v5 has payments.p2tr; fall back to a manual derivation if missing
        if (btc.payments.p2tr) return btc.payments.p2tr({ internalPubkey: pubkey.slice(1, 33), network });
        throw new Error('Taproot payments not supported by the loaded bitcoinjs-lib build.');
      default: throw new Error('Unknown address type: ' + addrType);
    }
  }

  // Heuristic: from a BIP-32 path like m/84'/0'/0'/0/0 guess the address type.
  function pathToAddrType(path) {
    const purpose = (path.match(/\/(\d+)'/) || [])[1];
    switch (purpose) {
      case '44': return 'p2pkh';
      case '49': return 'p2sh-p2wpkh';
      case '84': return 'p2wpkh';
      case '86': return 'p2tr';
      default:   return 'p2wpkh';
    }
  }

  function updateMsgSignDerivedAddress() {
    const out = document.getElementById('msgSignDerivedAddress');
    const path = (document.getElementById('msgSignPath') || {}).value || '';
    if (!out) return;
    try {
      const { node, network } = deriveNodeFromRoot(path);
      const addrType = pathToAddrType(path);
      const payment = paymentForKeyAndAddrType(node.publicKey, addrType, network);
      out.value = payment.address || '';
    } catch (e) {
      out.value = '';
    }
  }

  function updateMsgSignWifAddress() {
    const wif = (document.getElementById('msgSignWif') || {}).value || '';
    const addrType = (document.getElementById('msgSignWifAddressType') || {}).value || 'p2wpkh';
    const out = document.getElementById('msgSignWifAddress');
    if (!out) return;
    try {
      const btc = window.bitcoin;
      const network = btc.networks.bitcoin;
      const keyPair = btc.ECPair.fromWIF(wif.trim(), network);
      const payment = paymentForKeyAndAddrType(keyPair.publicKey, addrType, network);
      out.value = payment.address || '';
    } catch (e) {
      out.value = '';
    }
  }

  function onSignMessage() {
    const lib = getMessageLib();
    const errEl = document.getElementById('msgSignError');
    const resultWrap = document.querySelector('[data-msgsign-result]');
    const outEl = document.getElementById('msgSignOutput');
    const methodNote = document.getElementById('msgSignMethodNote');
    const setError = (msg) => { if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); } if (resultWrap) resultWrap.hidden = true; };
    if (errEl) errEl.classList.add('hidden');

    if (!lib) return setError('Message-signing library failed to load.');

    const source = (document.getElementById('msgSignSource') || {}).value || 'seed';
    const message = (document.getElementById('msgSignMessage') || {}).value || '';
    if (!message) return setError('Type a message to sign.');

    const requested = (document.getElementById('msgSigningStandard') || {}).value || 'auto';

    let privateKeyBuffer, compressed = true, address = '', addrType = 'p2wpkh', wifString = '';
    try {
      if (source === 'seed') {
        const path = (document.getElementById('msgSignPath') || {}).value || "m/84'/0'/0'/0/0";
        const { node, network } = deriveNodeFromRoot(path);
        privateKeyBuffer = node.privateKey;
        wifString = node.toWIF();
        addrType = pathToAddrType(path);
        const payment = paymentForKeyAndAddrType(node.publicKey, addrType, network);
        address = payment.address;
      } else {
        const wif = (document.getElementById('msgSignWif') || {}).value || '';
        if (!wif.trim()) throw new Error('Paste a WIF private key.');
        const btc = window.bitcoin;
        const network = btc.networks.bitcoin;
        const keyPair = btc.ECPair.fromWIF(wif.trim(), network);
        privateKeyBuffer = keyPair.privateKey;
        wifString = wif.trim();
        compressed = keyPair.compressed !== false;
        addrType = (document.getElementById('msgSignWifAddressType') || {}).value || 'p2wpkh';
        const payment = paymentForKeyAndAddrType(keyPair.publicKey, addrType, network);
        address = payment.address;
      }
    } catch (e) {
      return setError(e.message || String(e));
    }

    const standard = pickStandardForAddress(address, requested);

    try {
      let signature;
      if (standard === 'bip137') {
        // bitcoinjs-message expects a Buffer
        const sigBuf = lib.bip137.sign(message, privateKeyBuffer, compressed, undefined, { segwitType: addrType === 'p2wpkh' ? 'p2wpkh' : (addrType === 'p2sh-p2wpkh' ? 'p2sh(p2wpkh)' : undefined) });
        signature = sigBuf.toString('base64');
      } else {
        // bip322-js signature: (privateKeyWIF, address, message)
        signature = lib.bip322.sign(wifString, address, message);
      }

      if (outEl) outEl.value = signature;
      if (resultWrap) resultWrap.hidden = false;
      if (methodNote) methodNote.textContent = `Signed with ${standard.toUpperCase()} using address ${address}`;
      // Trigger a re-resize so the output textarea grows to fit
      if (typeof window.adjustPanelHeight === 'function') window.adjustPanelHeight();
    } catch (e) {
      setError('Signing failed: ' + (e.message || String(e)));
    }
  }

  function onVerifyMessage() {
    const lib = getMessageLib();
    const resultEl = document.getElementById('msgVerifyResult');
    const headingEl = document.getElementById('msgVerifyHeading');
    const detailEl = document.getElementById('msgVerifyDetail');
    const setResult = (ok, heading, detail) => {
      if (!resultEl) return;
      resultEl.hidden = false;
      resultEl.classList.toggle('verify-result--valid', ok);
      resultEl.classList.toggle('verify-result--invalid', !ok);
      if (headingEl) headingEl.textContent = heading;
      if (detailEl) detailEl.textContent = detail;
    };
    if (!lib) return setResult(false, 'Library not loaded', 'The message-signing library failed to load.');

    const address = ((document.getElementById('msgVerifyAddress') || {}).value || '').trim();
    const message = (document.getElementById('msgVerifyMessage') || {}).value || '';
    const signature = ((document.getElementById('msgVerifySignature') || {}).value || '').trim();

    if (!address || !message || !signature) {
      return setResult(false, 'Missing input', 'Address, message, and signature are all required.');
    }

    // Try BIP-322 first (handles all address types); fall back to BIP-137 if it fails or
    // throws - many BIP-137 signatures fail BIP-322 verification cleanly.
    let bip322Ok = false, bip322Err = null;
    try {
      bip322Ok = !!lib.bip322.verify(address, message, signature);
    } catch (e) { bip322Err = e.message || String(e); }

    if (bip322Ok) {
      return setResult(true, 'Valid signature', `Verified via BIP-322 for ${address}`);
    }

    let bip137Ok = false, bip137Err = null;
    try {
      bip137Ok = !!lib.bip137.verify(message, address, signature);
    } catch (e) { bip137Err = e.message || String(e); }

    if (bip137Ok) {
      return setResult(true, 'Valid signature', `Verified via BIP-137 for ${address}`);
    }

    const detail = bip137Err || bip322Err || 'The signature does not match the address and message.';
    return setResult(false, 'Invalid signature', detail);
  }

  // Wire UI listeners only if the tool view exists.
  function initMessageTool() {
    if (!document.querySelector('[data-tool="message"]')) return;

    const sourceSelect = document.getElementById('msgSignSource');
    function syncSource() {
      const value = (sourceSelect && sourceSelect.value) || 'seed';
      document.querySelectorAll('[data-msgsign-source]').forEach((el) => {
        el.hidden = el.dataset.msgsignSource !== value;
      });
      // Hide the seed-required hint if seed is loaded; show signer fields based on context
      const empty = document.querySelector('[data-signer-empty]');
      const fields = document.querySelector('.signer-fields');
      const seedLoaded = !!((document.getElementById('bip32RootKey') || {}).value);
      if (value === 'seed' && !seedLoaded) {
        if (empty) empty.hidden = false;
        if (fields) fields.hidden = true;
      } else {
        if (empty) empty.hidden = true;
        if (fields) fields.hidden = false;
      }
      if (value === 'seed') updateMsgSignDerivedAddress();
      else updateMsgSignWifAddress();
    }
    if (sourceSelect) sourceSelect.addEventListener('change', syncSource);

    function debounce(fn, ms) {
      let t = null;
      return function () { clearTimeout(t); t = setTimeout(fn, ms); };
    }
    const pathInput = document.getElementById('msgSignPath');
    if (pathInput) pathInput.addEventListener('input', debounce(updateMsgSignDerivedAddress, 180));

    const wifInput = document.getElementById('msgSignWif');
    if (wifInput) wifInput.addEventListener('input', debounce(updateMsgSignWifAddress, 180));
    const wifAddrTypeSelect = document.getElementById('msgSignWifAddressType');
    if (wifAddrTypeSelect) wifAddrTypeSelect.addEventListener('change', updateMsgSignWifAddress);

    const signBtn = document.getElementById('msgSignBtn');
    if (signBtn) signBtn.addEventListener('click', onSignMessage);
    const verifyBtn = document.getElementById('msgVerifyBtn');
    if (verifyBtn) verifyBtn.addEventListener('click', onVerifyMessage);

    // Re-check seed presence on every seed-bar refresh tick
    const previousRefreshLockState = refreshLockState;
    // We piggy-back: shell.js already polls for seed changes - we just expose a hook.
    document.addEventListener('seedtool:seed-changed', () => syncSource());

    syncSource();
  }

  // ----- Walkthrough live-data binding --------------------------------------
  //
  // Reads the user's loaded seed via the existing DOM fields (no separate state).
  // Each step in the walkthrough has data-learn-bind="key" and shows the value
  // (or a fallback message if no seed is loaded).
  function updateWalkthroughBindings() {
    const learnEmpty = document.querySelector('[data-learn-empty]');
    const learnLoaded = document.querySelector('[data-learn-loaded]');
    const rootXprv = (document.getElementById('bip32RootKey') || {}).value || '';
    const seedLoaded = !!rootXprv;
    if (learnEmpty) learnEmpty.hidden = seedLoaded;
    if (learnLoaded) learnLoaded.hidden = !seedLoaded;

    const values = {};
    if (seedLoaded) {
      try {
        const wordIndexesRaw = (document.getElementById('entropyWordIndexes') || {}).textContent || '';
        const phrase = (document.getElementById('bip39Phrase') || {}).value || '';
        const seedHex = (document.getElementById('bip39Seed') || {}).value || '';

        // Always reconstruct entropy bits from the mnemonic itself - dom.js's
        // entropy field reflects whatever the user typed into the entropy box,
        // which isn't necessarily the active seed's 128/256-bit entropy.
        let entropyBin = '';
        let checksumBin = '';
        if (phrase && window.bip39) {
          const wordlist = window.bip39.wordlists.english || Object.values(window.bip39.wordlists)[0];
          const words = phrase.trim().split(/\s+/);
          let bits = '';
          for (const w of words) {
            const idx = wordlist.indexOf(w);
            if (idx < 0) { bits = ''; break; }
            bits += idx.toString(2).padStart(11, '0');
          }
          if (bits) {
            const entropyBits = (words.length * 11) - Math.floor((words.length * 11) / 33);
            entropyBin = bits.slice(0, entropyBits);
            checksumBin = bits.slice(entropyBits);
          }
        }
        if (entropyBin) values.entropyBinary = formatBinaryGroups(entropyBin);
        if (checksumBin) values.checksumBits = checksumBin;

        // SHA-256 of entropy (for the checksum visualization)
        if (entropyBin && window.bitcoin && window.bitcoin.crypto && window.bitcoin.crypto.sha256) {
          try {
            const entropyBytes = binStringToBuffer(entropyBin);
            const hash = window.bitcoin.crypto.sha256(entropyBytes);
            values.entropyHash = bufferToHex(hash);
          } catch (e) { values.entropyHash = '(error computing hash: ' + (e.message || e) + ')'; }
        }

        if (phrase) {
          const words = phrase.trim().split(/\s+/);
          // dom.js stores entropyWordIndexes as a comma-separated list ("1437, 1446, ...")
          const idxParts = wordIndexesRaw.split(/[,\s]+/).filter(Boolean);
          // Fallback: if dom.js's indexes are missing, look up from the wordlist directly.
          const wordlist = window.bip39 ? (window.bip39.wordlists.english || Object.values(window.bip39.wordlists)[0]) : null;
          const indexes = (idxParts.length === words.length)
            ? idxParts
            : (wordlist ? words.map((w) => String(wordlist.indexOf(w))) : []);
          if (indexes.length === words.length) {
            const maxWordLen = Math.max(...words.map((w) => w.length));
            values.wordIndexes = words.map((w, i) =>
              `${String(i + 1).padStart(2, ' ')}.  ${w.padEnd(maxWordLen, ' ')}   ← index ${indexes[i]}`
            ).join('\n');
          } else {
            values.wordIndexes = words.map((w, i) => `${String(i + 1).padStart(2, ' ')}. ${w}`).join('\n');
          }
        }

        if (seedHex) values.seedHex = chunkHex(seedHex, 64);
        if (rootXprv) values.rootXprv = wrapString(rootXprv, 64);

        if (window.bip32 && window.bitcoin) {
          try {
            const network = window.bitcoin.networks.bitcoin;
            const root = window.bip32.fromBase58(rootXprv, network);
            const node = root.derivePath("m/84'/0'/0'/0/0");
            values.firstPubkey = bufferToHex(node.publicKey);
            const p = window.bitcoin.payments.p2wpkh({ pubkey: node.publicKey, network });
            values.firstAddress = p.address || '';
          } catch (_) { /* ignore */ }
        }
      } catch (_) { /* gracefully degrade */ }
    }

    // Apply to DOM
    document.querySelectorAll('[data-learn-bind]').forEach((el) => {
      const key = el.dataset.learnBind;
      const fallback = el.dataset.learnFallback || '';
      if (values[key]) {
        el.textContent = values[key];
        el.classList.remove('is-empty');
      } else {
        el.textContent = fallback;
        el.classList.add('is-empty');
      }
    });
  }

  function formatBinaryGroups(bits) {
    // Group binary string into rows of 64 bits, with spaces every 8 bits.
    const rows = [];
    for (let i = 0; i < bits.length; i += 64) {
      const row = bits.slice(i, i + 64);
      rows.push(row.replace(/(.{8})/g, '$1 ').trim());
    }
    return rows.join('\n');
  }
  function binStringToBuffer(bin) {
    // Pad to a multiple of 8, then convert to bytes.
    const pad = (8 - (bin.length % 8)) % 8;
    const padded = bin + '0'.repeat(pad);
    const out = new Uint8Array(padded.length / 8);
    for (let i = 0; i < padded.length; i += 8) {
      out[i / 8] = parseInt(padded.slice(i, i + 8), 2);
    }
    // bitcoinjs-lib's crypto.sha256 accepts Uint8Array (Buffer extends Uint8Array).
    return out;
  }
  function bufferToHex(buf) {
    if (!buf) return '';
    const bytes = buf.toString && typeof buf.toString === 'function' ? Array.from(buf) : buf;
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  function chunkHex(hex, width) {
    return hex.match(new RegExp(`.{1,${width}}`, 'g')).join('\n');
  }
  function wrapString(s, width) {
    return s.match(new RegExp(`.{1,${width}}`, 'g')).join('\n');
  }

  // ----- Walkthrough quick-roll button --------------------------------------
  // Triggers dom.js's existing "generate random seed" flow (no UX detour).
  // The seedbar's polling loop will refresh the walkthrough bindings automatically
  // once the new BIP32 root key value lands.
  function generateRandomSeedFromLearn() {
    const generateBtn = document.querySelector('.btn.generate');
    if (!generateBtn) return;
    // Make sure the seed-input modes are reset: select the Generate Random tab
    // (this is what dom.js triggers on init, so it should already be selected,
    // but force it in case the user navigated through tabs).
    const defaultTab = document.getElementById('defaultOpenTab');
    if (defaultTab) defaultTab.click();
    generateBtn.click();
  }

  const learnGenerateBtn = document.getElementById('learnGenerateSeed');
  if (learnGenerateBtn) learnGenerateBtn.addEventListener('click', generateRandomSeedFromLearn);
  const learnRerollBtn = document.getElementById('learnRerollSeed');
  if (learnRerollBtn) learnRerollBtn.addEventListener('click', generateRandomSeedFromLearn);

  // ----- Seed Phrase Recovery tool ------------------------------------------
  function initRecoverTool() {
    const view = document.querySelector('[data-tool="recover"]');
    if (!view) return;
    if (!window.seedRecover) {
      console.error('seedRecover engine not loaded');
      return;
    }

    const modeSelect      = document.getElementById('recoverMode');
    const wordsContainer  = document.getElementById('recoverWords');
    const wordCountSelect = document.getElementById('recoverWordCount');
    const langSelect      = document.getElementById('recoverLanguage');
    const langHint        = document.getElementById('recoverLangHint');
    const expandAbbrev    = document.getElementById('recoverExpandAbbrev');
    const addressInput    = document.getElementById('recoverAddress');
    const passInput       = document.getElementById('recoverPassphrase');
    const searchBtn       = document.getElementById('recoverSearchBtn');
    const cancelBtn       = document.getElementById('recoverCancelBtn');
    const progress        = document.getElementById('recoverProgress');
    const progressFill    = document.getElementById('recoverProgressFill');
    const progressText    = document.getElementById('recoverProgressText');
    const stats           = document.getElementById('recoverStats');
    const budgetEl        = document.getElementById('recoverBudget');
    const budgetText      = document.getElementById('recoverBudgetText');
    const errorEl         = document.getElementById('recoverError');
    const resultsEl       = document.getElementById('recoverResults');
    const resultsHeading  = document.getElementById('recoverResultsHeading');
    const resultsList     = document.getElementById('recoverResultsList');

    let currentCount = 12;
    let cancelled = false;

    // Trim language dropdown to only languages the bundled bip39 lib actually ships.
    // (Currently English-only; bundling more wordlists adds ~16KB each.)
    if (langSelect) {
      const available = Object.keys(window.bip39.wordlists);
      const lowered = available.map((k) => k.toLowerCase());
      Array.from(langSelect.options).forEach((opt) => {
        if (!lowered.includes(opt.value)) opt.remove();
      });
      if (langSelect.options.length <= 1) {
        // Only one wordlist available - hide the picker entirely to reduce noise.
        const wrapper = langSelect.parentElement;
        if (wrapper) {
          const label = wrapper.querySelector('label[for="recoverLanguage"]');
          if (label) label.style.display = 'none';
          langSelect.style.display = 'none';
        }
      }
    }

    // ----- Mode (encoding) switching ----
    function syncMode() {
      const mode = modeSelect.value;
      document.querySelectorAll('[data-recover-mode]').forEach((el) => {
        el.hidden = el.dataset.recoverMode !== mode;
      });
    }
    if (modeSelect) modeSelect.addEventListener('change', syncMode);

    // ----- Word grid (per-position cells with cycling state) ----
    function setWordCount(n) {
      currentCount = n;
      wordsContainer.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const cell = document.createElement('div');
        cell.className = 'recover-word';
        cell.dataset.index = String(i);
        cell.dataset.mark = 'clean';
        cell.innerHTML = `
          <span class="recover-word__num">${String(i + 1).padStart(2, '0')}</span>
          <input type="text" class="recover-word__input textarea-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="word ${i + 1}">
          <button type="button" class="recover-word__mark" title="Cycle mode" aria-label="Cycle word state">clean</button>
        `;
        wordsContainer.appendChild(cell);
      }
      // Cycle button handler - clean → typo → unknown → clean
      wordsContainer.querySelectorAll('.recover-word__mark').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cell = btn.closest('.recover-word');
          const next = { clean: 'typo', typo: 'unknown', unknown: 'clean' }[cell.dataset.mark] || 'clean';
          cell.dataset.mark = next;
          btn.textContent = next === 'typo' ? 'typo?' : next;
        });
      });
      // Live language detection as user types
      wordsContainer.querySelectorAll('.recover-word__input').forEach((input) => {
        input.addEventListener('input', debouncedDetect);
      });
    }
    if (wordCountSelect) wordCountSelect.addEventListener('change', () => setWordCount(parseInt(wordCountSelect.value, 10)));
    setWordCount(12);

    // ----- Live language detection ----
    let detectTimer = null;
    function debouncedDetect() {
      clearTimeout(detectTimer);
      detectTimer = setTimeout(detectLanguage, 350);
    }
    function detectLanguage() {
      if (!langHint || !langSelect) return;
      const words = readWordInputs();
      const nonEmpty = words.filter(Boolean);
      if (nonEmpty.length < 3) { langHint.hidden = true; return; }
      const lang = window.seedRecover.detectLanguage(nonEmpty);
      if (!lang) { langHint.hidden = true; return; }
      if (lang !== langSelect.value) {
        langHint.textContent = `These words look like ${labelForLanguage(lang)} - switch the language above to match.`;
        langHint.hidden = false;
      } else {
        langHint.hidden = true;
      }
    }
    function labelForLanguage(lang) {
      return { english: 'English', spanish: 'Spanish', french: 'French', italian: 'Italian',
        portuguese: 'Portuguese', czech: 'Czech', japanese: 'Japanese', korean: 'Korean',
        chinese_simplified: 'Chinese (Simplified)', chinese_traditional: 'Chinese (Traditional)' }[lang] || lang;
    }

    function readWordInputs() {
      return Array.from(wordsContainer.querySelectorAll('.recover-word__input')).map((i) => i.value.trim().toLowerCase());
    }
    function readWordMarks() {
      return Array.from(wordsContainer.querySelectorAll('.recover-word')).map((c) => c.dataset.mark);
    }

    // ----- Search workflow ----
    function clearResults() {
      errorEl.classList.add('hidden');
      errorEl.textContent = '';
      resultsEl.hidden = true;
      resultsList.innerHTML = '';
      budgetEl.hidden = true;
      stats.hidden = true;
      progress.hidden = true;
    }
    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    }
    function formatNumber(n) {
      if (n === Infinity) return '∞';
      return n.toLocaleString();
    }

    async function runSearch() {
      clearResults();
      cancelled = false;
      const mode = modeSelect.value;
      const language = langSelect.value;

      let words, wordMarks;
      try {
        if (mode === 'words') {
          words = readWordInputs();
          if (words.filter(Boolean).length === 0) throw new Error('Type the words you have first.');
          if (!words.every((w, i) => w || readWordMarks()[i] === 'unknown')) throw new Error('Empty positions must be marked "unknown".');
          wordMarks = readWordMarks();
        } else if (mode === 'hex') {
          const hex = (document.getElementById('recoverHex').value || '').trim();
          words = window.seedRecover.hexToWords(hex, language);
          wordMarks = words.map(() => 'clean');
        } else if (mode === 'binary') {
          const bin = (document.getElementById('recoverBinary').value || '').trim();
          words = window.seedRecover.binaryToWords(bin, language);
          wordMarks = words.map(() => 'clean');
        } else if (mode === 'indexes') {
          const idx = (document.getElementById('recoverIndexes').value || '').trim();
          words = window.seedRecover.indexesToWords(idx, language);
          wordMarks = words.map(() => 'clean');
        }
      } catch (e) {
        return showError(e.message || String(e));
      }

      const orderModes = {
        reverse:       document.getElementById('recoverOrderReverse').checked,
        adjacentSwap:  document.getElementById('recoverOrderAdjacent').checked,
        anySwap:       document.getElementById('recoverOrderAnySwap').checked,
      };

      const addressConstraint = (addressInput.value || '').trim();
      const passphrase = passInput.value || '';

      // Estimate the search space before starting
      try {
        const expanded = expandAbbrev.checked ? window.seedRecover.expandAbbreviations(words, language) : words;
        const list = window.seedRecover.WORDLISTS[language];
        const wlen = list.length;
        let perVariant = 1;
        for (let i = 0; i < expanded.length; i++) {
          const mark = wordMarks[i] || 'clean';
          if (mark === 'unknown') perVariant *= wlen;
          else if (mark === 'typo') perVariant *= 8; // rough Lev-1 count
        }
        let orderMultiplier = 1;
        if (orderModes.reverse) orderMultiplier += 1;
        if (orderModes.adjacentSwap) orderMultiplier += expanded.length - 1;
        if (orderModes.anySwap) orderMultiplier += (expanded.length * (expanded.length - 1)) / 2 - (expanded.length - 1);
        const grand = perVariant * orderMultiplier;
        if (grand > 5_000_000) {
          budgetEl.hidden = false;
          budgetText.textContent = `Search space is roughly ${formatNumber(grand)} candidates. This may take a long time. Add an address constraint, narrow down which words are uncertain, or cancel.`;
        } else if (grand > 100_000) {
          budgetEl.hidden = false;
          budgetText.textContent = `Search space is roughly ${formatNumber(grand)} candidates (~${Math.ceil(grand / 1500)}s expected).`;
        }
        if (!addressConstraint && grand > 100) {
          showError('Search will likely return many checksum-valid candidates with no way to tell them apart. Strongly recommend pasting a known address before searching.');
        }
      } catch (_) { /* non-fatal */ }

      searchBtn.hidden = true;
      cancelBtn.hidden = false;
      progress.hidden = false;
      stats.hidden = false;
      progressFill.style.width = '0%';
      progressText.textContent = 'Starting search…';

      try {
        const result = await window.seedRecover.search({
          words, wordMarks, language, orderModes,
          passphrase, addressConstraint, expandAbbrevs: expandAbbrev.checked,
          maxMatches: addressConstraint ? 10 : 50,
          stopOnFirstAddressMatch: !!addressConstraint,
        }, (p) => {
          if (cancelled) return false; // signal engine to stop
          const pct = p.total ? Math.min(100, (p.tested / p.total) * 100) : 0;
          progressFill.style.width = pct.toFixed(1) + '%';
          progressText.textContent = `${formatNumber(p.tested)} of ${formatNumber(p.total)} tested · ${(p.elapsed / 1000).toFixed(1)}s elapsed · ${p.matches} match${p.matches === 1 ? '' : 'es'}`;
          stats.textContent = progressText.textContent;
          return true;
        });

        showResults(result.matches, result.stats, !!addressConstraint);
      } catch (e) {
        showError(e.message || String(e));
      } finally {
        searchBtn.hidden = false;
        cancelBtn.hidden = true;
      }
    }

    function showResults(matches, statsObj, hadAddress) {
      resultsEl.hidden = false;
      if (!matches.length) {
        resultsHeading.textContent = 'No matches found';
        resultsList.innerHTML = `<p class="recover-empty">Searched ${formatNumber(statsObj.tested)} candidates in ${(statsObj.elapsed / 1000).toFixed(1)}s. Try expanding search options or check your input.</p>`;
        return;
      }
      if (hadAddress && matches.some((m) => m.addressMatch)) {
        resultsHeading.textContent = '✓ Match found';
      } else if (hadAddress) {
        resultsHeading.textContent = 'No address-matching candidate found';
      } else {
        resultsHeading.textContent = `${matches.length} candidate${matches.length === 1 ? '' : 's'} with a valid checksum`;
      }
      resultsList.innerHTML = '';
      matches.forEach((m, i) => {
        const card = document.createElement('div');
        card.className = 'recover-match' + (m.addressMatch ? ' recover-match--strong' : '');
        const mnemonic = m.words.join(' ');
        const detail = m.addressMatch
          ? `<span class="recover-match__badge">address match</span> at <code>${m.path}</code> (${m.addressType})`
          : `<span class="recover-match__badge recover-match__badge--weak">checksum valid · no address check</span>`;
        card.innerHTML = `
          <div class="recover-match__header">
            <span class="recover-match__index">#${i + 1}</span>
            ${detail}
          </div>
          <code class="recover-match__words private-data">${mnemonic}</code>
          <button type="button" class="recover-match__copy btn" data-copy="${encodeURIComponent(mnemonic)}">Copy mnemonic</button>
        `;
        resultsList.appendChild(card);
      });
      resultsList.querySelectorAll('[data-copy]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const text = decodeURIComponent(btn.dataset.copy);
          if (navigator.clipboard) navigator.clipboard.writeText(text);
          btn.textContent = 'Copied ✓';
          setTimeout(() => { btn.textContent = 'Copy mnemonic'; }, 1500);
        });
      });
    }

    if (searchBtn) searchBtn.addEventListener('click', runSearch);
    if (cancelBtn) cancelBtn.addEventListener('click', () => { cancelled = true; });
    syncMode();
  }

  // ----- Silent Payments tool -----------------------------------------------
  function initSilentTool() {
    const view = document.querySelector('[data-tool="silent"]');
    if (!view) return;
    if (!window.silentPayments) {
      console.error('Silent Payments library not loaded');
      return;
    }
    const sp = window.silentPayments;

    // RECEIVE - update fields whenever seed or network change
    const networkSelect = document.getElementById('spReceiveNetwork');
    function updateReceive() {
      const empty = document.querySelector('[data-sp-receive-empty]');
      const fields = document.querySelector('[data-sp-receive-fields]');
      const rootXprv = (document.getElementById('bip32RootKey') || {}).value || '';
      if (!rootXprv) {
        if (empty) empty.hidden = false;
        if (fields) fields.hidden = true;
        return;
      }
      if (empty) empty.hidden = true;
      if (fields) fields.hidden = false;
      try {
        const testnet = (networkSelect && networkSelect.value === 'testnet');
        const result = sp.silentPaymentAddressFromRoot(rootXprv, testnet);
        const a = document.getElementById('spReceiveAddress');
        const scanPath = document.getElementById('spReceiveScanPath');
        const spendPath = document.getElementById('spReceiveSpendPath');
        const scanPk = document.getElementById('spReceiveScanPubkey');
        const spendPk = document.getElementById('spReceiveSpendPubkey');
        if (a) a.value = result.address;
        if (scanPath) scanPath.textContent = result.scanPath;
        if (spendPath) spendPath.textContent = result.spendPath;
        if (scanPk) scanPk.value = result.scanPubkeyHex;
        if (spendPk) spendPk.value = result.spendPubkeyHex;

        // QR rendering - uses the bundled qrcode-generator (not qrcodejs).
        // API: new QRCode(typeNumber=0, errorCorrectLevel='L'|'M'|'Q'|'H')
        const qrDiv = document.getElementById('spReceiveQR');
        if (qrDiv && typeof window.QRCode === 'function') {
          const qr = new window.QRCode(0, 'M');
          qr.addData(result.address);
          qr.make();
          qrDiv.innerHTML = qr.createSvgTag({ cellSize: 4, scalable: true });
        }
      } catch (e) {
        console.error('SP receive error:', e);
      }
    }
    if (networkSelect) networkSelect.addEventListener('change', updateReceive);
    document.addEventListener('seedtool:seed-changed', updateReceive);

    // INSPECT - decode any sp1q… address into its scan + spend pubkeys
    const inspectBtn = document.getElementById('spInspectBtn');
    if (inspectBtn) inspectBtn.addEventListener('click', () => {
      const errEl = document.getElementById('spInspectError');
      const resultEl = document.getElementById('spInspectResult');
      errEl.classList.add('hidden');
      resultEl.hidden = true;
      const input = (document.getElementById('spInspectInput').value || '').trim().toLowerCase();
      if (!input) { errEl.textContent = 'Paste an sp1q… or tsp1q… address first.'; errEl.classList.remove('hidden'); return; }
      try {
        const decoded = sp.decodeSilentPaymentAddress(input);
        document.getElementById('spInspectNetwork').textContent = decoded.network;
        document.getElementById('spInspectVersion').textContent = String(decoded.version);
        document.getElementById('spInspectScan').textContent = decoded.scanPubkey;
        document.getElementById('spInspectSpend').textContent = decoded.spendPubkey;
        resultEl.hidden = false;
      } catch (e) {
        errEl.textContent = 'Decode failed: ' + (e.message || String(e));
        errEl.classList.remove('hidden');
      }
    });

    // SEND - compute the unique destination address from sp1q + UTXO
    const sendBtn = document.getElementById('spSendBtn');
    if (sendBtn) sendBtn.addEventListener('click', () => {
      const errEl = document.getElementById('spSendError');
      const resultEl = document.getElementById('spSendResult');
      const outEl = document.getElementById('spSendOutput');
      errEl.classList.add('hidden');
      resultEl.hidden = true;
      try {
        const spAddress = (document.getElementById('spSendAddress').value || '').trim();
        const inputWif = (document.getElementById('spSendWif').value || '').trim();
        const txid = (document.getElementById('spSendTxid').value || '').trim();
        const voutRaw = (document.getElementById('spSendVout').value || '').trim();
        const utxoType = (document.getElementById('spSendUtxoType').value || 'p2wpkh').trim();
        if (!spAddress) throw new Error('Paste the recipient\'s Silent Payment address.');
        if (!inputWif) throw new Error('Paste the WIF private key for the input UTXO.');
        if (!txid || !/^[0-9a-f]{64}$/i.test(txid)) throw new Error('Outpoint txid must be 64 hex chars.');
        const vout = parseInt(voutRaw, 10);
        if (isNaN(vout) || vout < 0) throw new Error('Outpoint vout must be a non-negative integer.');
        const dest = sp.computeSenderOutputAddress({ spAddress, inputWif, txid, vout, utxoType });
        outEl.value = dest;
        resultEl.hidden = false;
      } catch (e) {
        errEl.textContent = e.message || String(e);
        errEl.classList.remove('hidden');
      }
    });

    // Initial paint
    updateReceive();
  }

  // ----- Shamir Secret Sharing (SLIP-39 + SSKR) -----------------------------
  function initShamirTool() {
    const view = document.querySelector('[data-tool="shamir"]');
    if (!view) return;
    if (!window.shamir) {
      console.error('Shamir library bundle not loaded');
      return;
    }
    const slipLib = window.shamir.slip39;
    const sskrLib = window.shamir.sskr;
    const foundationLib = window.shamir.foundation;

    // Which standard is currently selected
    function currentStandard() {
      const r = view.querySelector('input[name="shamirStd"]:checked');
      return (r && r.value) || 'slip39';
    }

    const empty       = document.querySelector('[data-slip39-empty]');
    const fields      = document.querySelector('[data-slip39-fields]');
    const presetSel   = document.getElementById('slip39Preset');
    const customDiv   = document.querySelector('[data-slip39-custom]');
    const advancedDiv = document.querySelector('[data-slip39-advanced]');
    const customM     = document.getElementById('slip39CustomM');
    const customN     = document.getElementById('slip39CustomN');
    const groupThr    = document.getElementById('slip39GroupThreshold');
    const groupsTxt   = document.getElementById('slip39Groups');
    const passField   = document.getElementById('slip39Passphrase');
    const genBtn      = document.getElementById('slip39GenerateBtn');
    const genErr      = document.getElementById('slip39GenError');
    const genResults  = document.getElementById('slip39GenResults');
    const sharesList  = document.getElementById('slip39SharesList');
    const resultsHead = document.getElementById('slip39ResultsHeading');

    const recoverSharesTxt = document.getElementById('slip39RecoverShares');
    const recoverPassTxt   = document.getElementById('slip39RecoverPassphrase');
    const recoverBtn       = document.getElementById('slip39RecoverBtn');
    const recoverErr       = document.getElementById('slip39RecoverError');
    const recoverResult    = document.getElementById('slip39RecoverResult');
    const recoverHexOut    = document.getElementById('slip39RecoverHex');
    const recoverBip39Out  = document.getElementById('slip39RecoverBip39');

    // Map preset → groups + groupThreshold
    const PRESETS = {
      '1of1': { groups: [[1, 1, 'Single share']], threshold: 1 },
      '2of2': { groups: [[2, 2, '2-of-2']],       threshold: 1 },
      '2of3': { groups: [[2, 3, '2-of-3']],       threshold: 1 },
      '3of5': { groups: [[3, 5, '3-of-5']],       threshold: 1 },
      '5of7': { groups: [[5, 7, '5-of-7']],       threshold: 1 },
    };

    function syncPreset() {
      const v = presetSel.value;
      customDiv.hidden = (v !== 'custom');
      advancedDiv.hidden = (v !== 'advanced');
    }
    if (presetSel) presetSel.addEventListener('change', syncPreset);

    function syncSeedState() {
      const rootXprv = (document.getElementById('bip32RootKey') || {}).value || '';
      if (!rootXprv) { empty.hidden = false; fields.hidden = true; }
      else { empty.hidden = true; fields.hidden = false; }
    }
    document.addEventListener('seedtool:seed-changed', syncSeedState);

    // Convert the loaded BIP-39 mnemonic to its entropy hex (the master secret)
    function loadedSeedEntropyHex() {
      const phrase = (document.getElementById('bip39Phrase') || {}).value || '';
      if (!phrase) throw new Error('No seed loaded.');
      if (!window.bip39) throw new Error('BIP-39 library not loaded.');
      const wordlist = window.bip39.wordlists.english || Object.values(window.bip39.wordlists)[0];
      return window.bip39.mnemonicToEntropy(phrase, wordlist);
    }

    function parseAdvancedGroups() {
      const lines = (groupsTxt.value || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^(\d+)\s*[-x ]?of\s*(\d+)$/i) || lines[i].match(/^(\d+)\s*[/-]\s*(\d+)$/);
        if (!m) throw new Error(`Group ${i + 1} ("${lines[i]}") - use M-of-N format, e.g. 2-of-3`);
        const M = parseInt(m[1], 10), N = parseInt(m[2], 10);
        if (M < 1 || N < 1 || M > N || N > 16) throw new Error(`Group ${i + 1}: invalid M/N`);
        out.push([M, N, `Group ${i + 1} ${M}-of-${N}`]);
      }
      return out;
    }

    async function onGenerate() {
      genErr.classList.add('hidden');
      genResults.hidden = true;
      sharesList.innerHTML = '';
      try {
        const v = presetSel.value;
        let groups, groupThreshold;
        if (PRESETS[v]) {
          groups = PRESETS[v].groups;
          groupThreshold = PRESETS[v].threshold;
        } else if (v === 'custom') {
          const M = parseInt(customM.value, 10);
          const N = parseInt(customN.value, 10);
          if (M < 1 || N < 1 || M > N || N > 16) throw new Error('Threshold M must be 1..N, N must be 1..16.');
          if (M === 1 && N > 1) throw new Error('Per Shamir spec, M=1 with N>1 is disallowed (use 1-of-1).');
          groups = [[M, N, `${M}-of-${N}`]];
          groupThreshold = 1;
        } else if (v === 'advanced') {
          groups = parseAdvancedGroups();
          groupThreshold = parseInt(groupThr.value, 10);
          if (groupThreshold < 1 || groupThreshold > groups.length) throw new Error('Group threshold must be 1..' + groups.length);
        } else {
          throw new Error('Pick a configuration.');
        }
        const masterSecretHex = loadedSeedEntropyHex();
        const std = currentStandard();
        const passphrase = passField.value || '';

        let result;
        if (std === 'slip39') {
          result = await slipLib.generate(masterSecretHex, { groups, groupThreshold, passphrase });
        } else if (std === 'sskr') {
          result = sskrLib.generate(masterSecretHex, { groups, groupThreshold });
        } else if (std === 'foundation') {
          result = foundationLib.generate(masterSecretHex, { groups, groupThreshold });
        }

        const isAdvanced = result.groups.length > 1;
        const stdLabel = std === 'slip39' ? 'SLIP-39'
                       : std === 'sskr'   ? 'SSKR'
                       : 'Foundation Shard';
        resultsHead.textContent = (isAdvanced
          ? `${stdLabel} · ${result.groups.length} groups (${groupThreshold}-of-${result.groups.length} groups needed)`
          : `${stdLabel} · ${groups[0][0]}-of-${groups[0][1]} - ${groups[0][1]} shares`);

        result.groups.forEach((groupShares, gi) => {
          if (isAdvanced) {
            const groupHeader = document.createElement('h4');
            groupHeader.className = 'slip39-group-header';
            groupHeader.textContent = `Group ${gi + 1} (${groups[gi][0]}-of-${groups[gi][1]}, ${groupShares.length} shares)`;
            sharesList.appendChild(groupHeader);
          }
          groupShares.forEach((shareData, idx) => {
            const card = document.createElement('div');
            card.className = 'slip39-share private-data';
            const fmtNote = std === 'sskr' ? '<span class="slip39-share__fmt">hex</span>'
                         : std === 'foundation' ? '<span class="slip39-share__fmt slip39-share__fmt--foundation">dCBOR hex</span>'
                         : '';
            card.innerHTML =
              '<div class="slip39-share__header">' +
                '<span class="slip39-share__num">Share ' + (idx + 1) + ' of ' + groupShares.length + '</span>' +
                fmtNote +
                '<button type="button" class="btn slip39-share__copy" data-copy="' + encodeURIComponent(shareData) + '">Copy</button>' +
              '</div>' +
              '<code class="slip39-share__words">' + shareData + '</code>';
            sharesList.appendChild(card);
          });
        });
        sharesList.querySelectorAll('[data-copy]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const text = decodeURIComponent(btn.dataset.copy);
            if (navigator.clipboard) navigator.clipboard.writeText(text);
            btn.textContent = 'Copied ✓';
            setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
          });
        });
        genResults.hidden = false;
      } catch (e) {
        genErr.textContent = e.message || String(e);
        genErr.classList.remove('hidden');
      }
    }

    async function onRecover() {
      recoverErr.classList.add('hidden');
      recoverResult.hidden = true;
      try {
        const lines = (recoverSharesTxt.value || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
        if (!lines.length) throw new Error('Paste at least one share.');
        const std = currentStandard();
        let hex;
        if (std === 'slip39') {
          hex = await slipLib.recover(lines, recoverPassTxt.value || '');
        } else if (std === 'sskr') {
          hex = sskrLib.recover(lines);
        } else if (std === 'foundation') {
          hex = foundationLib.recover(lines);
        }
        recoverHexOut.value = hex;
        try {
          const wordlist = window.bip39.wordlists.english || Object.values(window.bip39.wordlists)[0];
          recoverBip39Out.value = window.bip39.entropyToMnemonic(hex, wordlist);
        } catch (_) {
          recoverBip39Out.value = '(this entropy length does not correspond to a standard BIP-39 mnemonic)';
        }
        recoverResult.hidden = false;
      } catch (e) {
        recoverErr.textContent = e.message || String(e);
        recoverErr.classList.remove('hidden');
      }
    }

    if (genBtn) genBtn.addEventListener('click', onGenerate);
    if (recoverBtn) recoverBtn.addEventListener('click', onRecover);

    // Standard switching - show/hide passphrase fields, the no-passphrase
    // note, and swap the recover-shares input label + placeholder so users
    // know what format to paste.
    function syncStandard() {
      const std = currentStandard();
      const isSlip = (std === 'slip39');
      view.querySelectorAll('[data-shamir-passphrase], [data-shamir-recover-passphrase]')
        .forEach((el) => { el.hidden = !isSlip; });
      const note = view.querySelector('[data-shamir-sskr-note]');
      if (note) note.hidden = isSlip;

      const recoverLabel = document.getElementById('slip39RecoverSharesLabel');
      const recoverInput = document.getElementById('slip39RecoverShares');
      const foundationHint = document.getElementById('shamirFoundationHint');
      if (recoverLabel && recoverInput) {
        if (std === 'slip39') {
          recoverLabel.textContent = 'Shares (SLIP-39 mnemonics)';
          recoverInput.setAttribute('placeholder',
            'Paste each share\'s mnemonic on its own line - e.g. "academic acid acrobat romp …"');
        } else if (std === 'sskr') {
          recoverLabel.textContent = 'Shares (raw SSKR hex bytes)';
          recoverInput.setAttribute('placeholder',
            'Paste each share as a hex string on its own line - e.g. "14ea000100ec3a68c8d9bfc1 …"');
        } else if (std === 'foundation') {
          recoverLabel.textContent = 'Shares (Foundation Shard dCBOR hex)';
          recoverInput.setAttribute('placeholder',
            'Paste each Foundation Shard hex on its own line - typically starts with "a2008201…"');
        }
      }
      if (foundationHint) foundationHint.hidden = (std !== 'foundation');
    }
    view.querySelectorAll('input[name="shamirStd"]').forEach((r) => {
      r.addEventListener('change', syncStandard);
    });

    // Initial paint
    syncPreset();
    syncSeedState();
    syncStandard();
  }

  // ----- BIP-329 Wallet Labels decoder --------------------------------------
  function initLabelsTool() {
    const view = document.querySelector('[data-tool="labels"]');
    if (!view || !window.decoders) return;
    const lib = window.decoders.bip329;

    const inputEl   = document.getElementById('labelsInput');
    const decodeBtn = document.getElementById('labelsDecodeBtn');
    const errEl     = document.getElementById('labelsError');
    const resultEl  = document.getElementById('labelsResult');
    const statsEl   = document.getElementById('labelsStats');
    const groupsEl  = document.getElementById('labelsGroups');
    const fileEl    = document.getElementById('labelsFile');
    const filenameEl = document.getElementById('labelsFilename');

    if (fileEl) {
      fileEl.addEventListener('change', () => {
        const file = fileEl.files && fileEl.files[0];
        if (!file) return;
        // Soft cap at 25 MB - a real export will be a few KB to a few MB at most.
        if (file.size > 25 * 1024 * 1024) {
          errEl.textContent = `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit is 25 MB.`;
          errEl.classList.remove('hidden');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          inputEl.value = String(reader.result || '').trim();
          if (filenameEl) {
            filenameEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            filenameEl.hidden = false;
          }
          errEl.classList.add('hidden');
          // Auto-decode once a file is loaded
          decodeBtn.click();
        };
        reader.onerror = () => {
          errEl.textContent = 'Could not read the file. Try copying its contents into the textarea instead.';
          errEl.classList.remove('hidden');
        };
        reader.readAsText(file);
      });
    }

    const TYPE_LABELS = {
      tx:     'Transactions',
      addr:   'Addresses',
      pubkey: 'Public keys',
      input:  'Inputs',
      output: 'Outputs',
      xpub:   'Extended keys (xpubs)',
    };

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function render(parsed) {
      const totalLabel = `${parsed.stats.total} ${parsed.stats.total === 1 ? 'label' : 'labels'}`;
      const errorLabel = parsed.stats.errors ? ` · ${parsed.stats.errors} parse error${parsed.stats.errors === 1 ? '' : 's'}` : '';
      const counts = Object.entries(parsed.stats.byType)
        .filter(([, c]) => c > 0)
        .map(([t, c]) => `${c} ${TYPE_LABELS[t].toLowerCase()}`)
        .join(' · ');
      statsEl.innerHTML = `<strong>${totalLabel}</strong> parsed${errorLabel}${counts ? ` - ${counts}` : ''}`;

      groupsEl.innerHTML = '';

      // Errors block first
      if (parsed.errors.length) {
        const block = document.createElement('div');
        block.className = 'labels-group labels-group--errors';
        block.innerHTML = `<h3>Parse errors</h3><ul>` + parsed.errors.map((e) =>
          `<li><span class="labels-line">line ${e.lineIndex}</span> · ${escapeHtml(e.message)} <code>${escapeHtml(e.lineSnippet)}…</code></li>`
        ).join('') + `</ul>`;
        groupsEl.appendChild(block);
      }

      // One group per non-empty type
      for (const type of lib.TYPES) {
        const entries = parsed.groups[type];
        if (!entries.length) continue;
        const block = document.createElement('div');
        block.className = 'labels-group';
        const rows = entries.map((e) => {
          const flags = [];
          if (e.spendable === false) flags.push('<span class="labels-flag labels-flag--frozen">frozen</span>');
          else if (e.spendable === true) flags.push('<span class="labels-flag">spendable</span>');
          if (e.origin) flags.push(`<span class="labels-flag">origin: <code>${escapeHtml(e.origin)}</code></span>`);
          return `
            <tr>
              <td class="labels-ref"><code>${escapeHtml(e.ref)}</code></td>
              <td class="labels-label">${escapeHtml(e.label) || '<em class="labels-empty">(empty - deletion marker)</em>'}</td>
              <td class="labels-flags">${flags.join(' ')}</td>
            </tr>`;
        }).join('');
        block.innerHTML = `
          <h3>${TYPE_LABELS[type]} <span class="labels-count">${entries.length}</span></h3>
          <table class="labels-table">
            <thead><tr><th>Reference</th><th>Label</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
        groupsEl.appendChild(block);
      }
      resultEl.hidden = false;
    }

    decodeBtn.addEventListener('click', () => {
      errEl.classList.add('hidden');
      resultEl.hidden = true;
      try {
        const text = (inputEl.value || '').trim();
        if (!text) throw new Error('Paste a BIP-329 JSONL export first.');
        const parsed = lib.parse(text);
        if (!parsed.entries.length && parsed.errors.length) {
          throw new Error(`No valid entries (${parsed.errors.length} parse error${parsed.errors.length === 1 ? '' : 's'}).`);
        }
        render(parsed);
      } catch (e) {
        errEl.textContent = e.message || String(e);
        errEl.classList.remove('hidden');
      }
    });

    // --- Demo data ---
    const demoBtn = document.getElementById('labelsDemoBtn');
    const demoBanner = document.getElementById('labelsDemoBanner');
    const demoLabel = document.getElementById('labelsDemoLabel');
    const demoClear = document.getElementById('labelsDemoClear');
    const DEMO_LABELS = [
      '{"type":"xpub","ref":"xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz","label":"Savings account"}',
      '{"type":"tx","ref":"f546156d683844f97697f4e9c0bf0c97f56935d1d6bbe73e9c1b04bc8b3ce5a8","label":"Bought pizza","origin":"wsh(sortedmulti(2,[d34db33f/48h/0h/0h/2h]xpub6E.../0/*,...))"}',
      '{"type":"addr","ref":"bc1qfoundationxlnj4tvqsy3rps8aez3hzs82gvm0xx","label":"Donation address"}',
      '{"type":"addr","ref":"bc1qsavingsuwz6tg44gqzzr2syka7mnmuzudmwjt6","label":"Cold storage receive 0","spendable":true}',
      '{"type":"output","ref":"f91d0a8a78462bc59398f2c5d7a84fcff491c26ba54c4833478b202796c8aafd:1","label":"Change","spendable":true}',
      '{"type":"output","ref":"a0a99ffcc8625b7f0c4eb1c2a47d4a37e6f8e7eb86df3f6acce0a8db77d5f3a3:0","label":"Locked - regulatory hold","spendable":false}',
      '{"type":"input","ref":"3d9d8fd62a92a1fda3a52d8e8eaf3ad9e8e4a4cdcf3e8e08c2b1bc4b96b8d1ef:0","label":"From cold storage"}',
      '{"type":"pubkey","ref":"02c97dc3f4420402b1b1cea5a14c10b75c8e7e9f23c8b9e1e9c0e2c5c8e5d8f7a4","label":"Alice (cosigner)"}',
      '{"type":"tx","ref":"4f8b14ab5f9bb39f2db1c25a8a9be8e7f1bdcf41f76c0ee6f0fc18e1d5a8e6f0","label":"Coinbase withdrawal April 2026"}',
      '{"type":"xpub","ref":"xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz","label":""}',
    ].join('\n');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        inputEl.value = DEMO_LABELS;
        demoLabel.textContent = '10 sample labels across all six BIP-329 types (the last one is an empty-label deletion marker).';
        demoBanner.hidden = false;
        if (filenameEl) { filenameEl.hidden = true; filenameEl.textContent = ''; }
        decodeBtn.click();
      });
    }
    if (demoClear) {
      demoClear.addEventListener('click', () => {
        inputEl.value = '';
        resultEl.hidden = true;
        errEl.classList.add('hidden');
        demoBanner.hidden = true;
      });
    }
  }

  // ----- Lightning decoder (BOLT-11 + BOLT-12) ------------------------------
  function initLightningTool() {
    const view = document.querySelector('[data-tool="lightning"]');
    if (!view || !window.decoders) return;

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function u8ToHex(u8) {
      return Array.from(u8).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    function stringify(value) {
      return JSON.stringify(value, (k, v) => {
        if (typeof v === 'bigint') return v.toString();
        if (v instanceof Uint8Array) return u8ToHex(v);
        return v;
      }, 2);
    }

    function renderField(label, value, opts) {
      opts = opts || {};
      if (value === null || value === undefined || value === '') return '';
      let display = value;
      let span = !!opts.span;
      if (value instanceof Uint8Array) {
        display = u8ToHex(value);
        if (display.length > 80) span = true;
      } else if (typeof value === 'bigint') {
        display = value.toString();
      } else if (typeof value === 'object') {
        display = stringify(value);
        span = true;
      } else if (typeof value === 'string' && value.length > 80) {
        span = true;
      }
      const isMono = opts.mono !== false;
      const cls = `ln-field ${span ? 'ln-field--wide' : ''} ${isMono ? 'ln-field--mono' : ''}`.trim();
      return `<div class="${cls}"><span class="ln-field__label">${escapeHtml(label)}</span><span class="ln-field__value">${escapeHtml(display)}</span></div>`;
    }

    function renderBolt11(d) {
      const parts = [];
      parts.push(renderField('Network', d.network || 'mainnet', { mono: false }));
      if (d.amountSats !== null) parts.push(renderField('Amount', `${d.amountSats.toLocaleString()} sats (${d.amountBtc} BTC, ${d.millisatoshis} msat)`));
      else parts.push(renderField('Amount', '(any - invoice has no amount fixed)', { mono: false }));
      if (d.timestampDate) parts.push(renderField('Created at', d.timestampDate, { mono: false }));
      if (d.expirySeconds !== null) parts.push(renderField('Expires', `${d.expirySeconds} sec after creation${d.expiryDate ? ' → ' + d.expiryDate : ''}`, { mono: false }));
      if (d.minFinalCltvExpiry !== null) parts.push(renderField('Min final CLTV', d.minFinalCltvExpiry + ' blocks', { mono: false }));
      if (d.description) parts.push(renderField('Description', d.description, { mono: false, span: true }));
      if (d.descriptionHash) parts.push(renderField('Description hash', d.descriptionHash));
      if (d.paymentHash) parts.push(renderField('Payment hash', d.paymentHash));
      if (d.paymentSecret) parts.push(renderField('Payment secret', d.paymentSecret));
      if (d.payeeNodeId) parts.push(renderField('Payee node ID', d.payeeNodeId));
      if (d.fallbackAddress) parts.push(renderField('Fallback address', d.fallbackAddress));
      if (d.features && Object.keys(d.features).length) parts.push(renderField('Features', d.features));
      if (d.routeHints && d.routeHints.length) {
        parts.push(`<div class="ln-field ln-field--wide ln-field--mono">
          <span class="ln-field__label">Route hints (${d.routeHints.length})</span>
          <span class="ln-field__value">${escapeHtml(JSON.stringify(d.routeHints, null, 2))}</span>
        </div>`);
      }
      if (d.signature) parts.push(renderField('Signature', d.signature));
      return parts.join('');
    }

    function renderBolt12(decoded) {
      const parts = [];
      parts.push(renderField('Type', decoded.kind.replace('_', ' '), { mono: false }));
      const f = decoded.fields || {};
      // Friendly labels for known keys
      const labels = {
        hrp: 'HRP',
        offer_id: 'Offer ID',
        description: 'Description',
        issuer: 'Issuer',
        amount: 'Amount (msat)',
        currency: 'Currency',
        chains: 'Chains',
        features: 'Features',
        quantity_min: 'Min quantity',
        quantity_max: 'Max quantity',
        absolute_expiry: 'Absolute expiry',
        node_id: 'Node ID',
        signature: 'Signature',
        has_paths: 'Has blinded paths',
        paths: 'Blinded paths',
        records: 'Raw TLV records',
        payer_id: 'Payer ID',
        payer_note: 'Payer note',
        payer_info: 'Payer info',
        payment_hash: 'Payment hash',
        relative_expiry: 'Relative expiry (s)',
        created_at: 'Created at',
      };
      const stringKeys = new Set(['description', 'issuer', 'currency', 'payer_note', 'hrp']);
      for (const [k, v] of Object.entries(f)) {
        if (v === undefined || v === null) continue;
        const label = labels[k] || k;
        const isStringField = stringKeys.has(k);
        parts.push(renderField(label, v, { mono: !isStringField }));
      }
      return parts.join('');
    }

    const bolt11Input  = document.getElementById('bolt11Input');
    const bolt11Btn    = document.getElementById('bolt11DecodeBtn');
    const bolt11Err    = document.getElementById('bolt11Error');
    const bolt11Result = document.getElementById('bolt11Result');
    bolt11Btn.addEventListener('click', () => {
      bolt11Err.classList.add('hidden');
      bolt11Result.hidden = true;
      try {
        const invoice = (bolt11Input.value || '').trim();
        if (!invoice) throw new Error('Paste a BOLT-11 invoice first (starts with "lnbc").');
        const decoded = window.decoders.bolt11.decode(invoice);
        bolt11Result.innerHTML = renderBolt11(decoded);
        bolt11Result.hidden = false;
      } catch (e) {
        bolt11Err.textContent = e.message || String(e);
        bolt11Err.classList.remove('hidden');
      }
    });

    const bolt12Input  = document.getElementById('bolt12Input');
    const bolt12Btn    = document.getElementById('bolt12DecodeBtn');
    const bolt12Err    = document.getElementById('bolt12Error');
    const bolt12Result = document.getElementById('bolt12Result');
    bolt12Btn.addEventListener('click', () => {
      bolt12Err.classList.add('hidden');
      bolt12Result.hidden = true;
      try {
        const input = (bolt12Input.value || '').trim();
        if (!input) throw new Error('Paste a BOLT-12 offer / invoice / invoice request first.');
        const decoded = window.decoders.bolt12.decode(input);
        bolt12Result.innerHTML = renderBolt12(decoded);
        bolt12Result.hidden = false;
      } catch (e) {
        bolt12Err.textContent = e.message || String(e);
        bolt12Err.classList.remove('hidden');
      }
    });

    // --- Demo data: BOLT-11 ---
    const DEMO_BOLT11 = 'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp';
    const bolt11DemoBtn = document.getElementById('bolt11DemoBtn');
    const bolt11DemoBanner = document.getElementById('bolt11DemoBanner');
    const bolt11DemoLabel = document.getElementById('bolt11DemoLabel');
    const bolt11DemoClear = document.getElementById('bolt11DemoClear');
    if (bolt11DemoBtn) {
      bolt11DemoBtn.addEventListener('click', () => {
        bolt11Input.value = DEMO_BOLT11;
        bolt11DemoLabel.textContent = 'BOLT-11 spec test vector: "1 cup coffee", 250,000 sats, mainnet.';
        bolt11DemoBanner.hidden = false;
        bolt11Btn.click();
      });
    }
    if (bolt11DemoClear) {
      bolt11DemoClear.addEventListener('click', () => {
        bolt11Input.value = '';
        bolt11Result.hidden = true;
        bolt11Err.classList.add('hidden');
        bolt11DemoBanner.hidden = true;
      });
    }

    // --- Demo data: BOLT-12 ---
    const DEMO_BOLT12 = 'lno1pgqppmsrse80qf0aara4slvcjxrvu6j2rp5ftmjy4yntlsmsutpkvkt6878sxn8g96fuzlhw75hendmuhjy0gp607tsgzaasdvjmstcwcgc6vgwyqgp6mv9u948ngt3j0urev4ga0vw06cpvasexgn00feez9vfgdkyykfgqxdaa8ysjuy8um26ekywlceecwalj0zvqu5h0dd486uhhzvj9m3qlnmaa9awj0cft7x95h7yn9vaep4gm055q8rsctl6lthka2htmk8pzxvgyzae72gnapuhg2v9rtgwfg4mlr56lqqerat2vv2u2aka8e592vqluf5erqqs2ve30snd2pr2d0h7fdfl9js6wyzjl4c66nu6d32nj4w2ft0um9q4q';
    const bolt12DemoBtn = document.getElementById('bolt12DemoBtn');
    const bolt12DemoBanner = document.getElementById('bolt12DemoBanner');
    const bolt12DemoLabel = document.getElementById('bolt12DemoLabel');
    const bolt12DemoClear = document.getElementById('bolt12DemoClear');
    if (bolt12DemoBtn) {
      bolt12DemoBtn.addEventListener('click', () => {
        bolt12Input.value = DEMO_BOLT12;
        bolt12DemoLabel.textContent = 'BOLT-12 offer with blinded paths, sourced from the bolt12-utils README.';
        bolt12DemoBanner.hidden = false;
        bolt12Btn.click();
      });
    }
    if (bolt12DemoClear) {
      bolt12DemoClear.addEventListener('click', () => {
        bolt12Input.value = '';
        bolt12Result.hidden = true;
        bolt12Err.classList.add('hidden');
        bolt12DemoBanner.hidden = true;
      });
    }
  }

  // ----- Miniscript Lab -----------------------------------------------------
  function initMiniscriptTool() {
    const view = document.querySelector('[data-tool="miniscript"]');
    if (!view || !window.miniscript) return;
    const lib = window.miniscript;

    const modeEl    = document.getElementById('msMode');
    const ctxEl     = document.getElementById('msContext');
    const inputEl   = document.getElementById('msInput');
    const compileBtn = document.getElementById('msCompileBtn');
    const errEl     = document.getElementById('msError');
    const readyEl   = document.getElementById('msReadyHint');
    const resultEl  = document.getElementById('msResult');
    const sectMs    = document.getElementById('msSectionMiniscript');
    const outMs     = document.getElementById('msOutMiniscript');
    const outAsm    = document.getElementById('msOutAsm');
    const outHex    = document.getElementById('msOutHex');
    const outSize   = document.getElementById('msOutScriptSize');
    const flagsEl   = document.getElementById('msFlags');
    const pathsEl   = document.getElementById('msPaths');
    const pathsHint = document.getElementById('msPathsHint');

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function renderFlags(a, scriptBytes) {
      const items = [];
      const ok = (label) => `<li class="ms-flag ms-flag--ok"><span class="ms-flag__dot"></span> ${escapeHtml(label)}</li>`;
      const bad = (label) => `<li class="ms-flag ms-flag--bad"><span class="ms-flag__dot"></span> ${escapeHtml(label)}</li>`;
      const warn = (label) => `<li class="ms-flag ms-flag--warn"><span class="ms-flag__dot"></span> ${escapeHtml(label)}</li>`;

      items.push(a.issane ? ok('Sane at top level (safe to use)') : bad('NOT sane at top level - unsafe'));
      items.push(a.issanesublevel ? ok('Sane at every sub-level') : warn('Some sub-expression is not sane'));
      items.push(a.valid ? ok('Valid Miniscript') : bad('Invalid Miniscript: ' + (a.error || 'unknown')));
      items.push(a.nonMalleable ? ok('Non-malleable spend paths') : warn('Some spend paths are malleable (third parties can mangle witnesses)'));
      items.push(a.needsSignature ? ok('Requires a signature to spend') : warn('Spendable without any signature'));
      items.push(a.timelockMix ? bad('Mixes absolute and relative timelocks (cannot combine in one tx)') : ok('No timelock mixing'));
      items.push(a.hasDuplicateKeys ? warn('Duplicate keys present - uses same key on multiple branches') : ok('No duplicate keys'));
      if (typeof scriptBytes === 'number') items.push(ok(`Script size: ${scriptBytes} bytes`));
      flagsEl.innerHTML = items.join('');
    }

    function renderPaths(spend) {
      const total = spend.nonMalleable.length + spend.malleable.length;
      if (!total) {
        pathsHint.textContent = 'No spend paths found.';
        pathsEl.innerHTML = '';
        return;
      }
      pathsHint.textContent = `${spend.nonMalleable.length} non-malleable path${spend.nonMalleable.length === 1 ? '' : 's'}` +
        (spend.malleable.length ? ` + ${spend.malleable.length} malleable` : '') + '.';

      // Compute the longest timelock across all paths so timelines can share scale.
      const SEQUENCE_TIME_FLAG = 0x00400000;
      const SEQUENCE_LOCKTIME_MASK = 0x0000ffff;
      const BLOCK_SECONDS = 600;
      function relativeLockSeconds(seq) {
        if (typeof seq !== 'number') return 0;
        if (seq & SEQUENCE_TIME_FLAG) return (seq & SEQUENCE_LOCKTIME_MASK) * 512;
        return (seq & 0xffff) * BLOCK_SECONDS;
      }
      const allRelativeSecs = [];
      [...spend.nonMalleable, ...spend.malleable].forEach((p) => {
        if (typeof p.nSequence === 'number') allRelativeSecs.push(relativeLockSeconds(p.nSequence));
      });
      const maxRelativeSecs = allRelativeSecs.length ? Math.max(...allRelativeSecs) : 0;

      const SVG_KEY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>';
      const SVG_HASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>';

      const rows = [];
      const render = (p, idx, isMalleable) => {
        const relSecs = typeof p.nSequence === 'number' ? relativeLockSeconds(p.nSequence) : 0;
        const hasRelLock = typeof p.nSequence === 'number';
        const hasAbsLock = typeof p.nLockTime === 'number';
        const hasPreimage = p.preimages && p.preimages.length > 0;
        const hasTimelock = hasRelLock || hasAbsLock;

        // Classification (immediate / timelocked / preimage / malleable)
        let category = 'immediate';
        if (isMalleable) category = 'malleable';
        else if (hasTimelock) category = 'timelocked';
        else if (hasPreimage) category = 'preimage';

        // Status pill copy + colour
        let statusLabel = 'Available now';
        let statusKlass = 'ok';
        if (hasRelLock) {
          const d = lib.describeOlder ? lib.describeOlder(p.nSequence) : null;
          if (d && d.kind === 'time') statusLabel = `Activates ~${formatTimeShort(d.seconds)} after funding`;
          else if (d) statusLabel = `Activates after ${d.blocks.toLocaleString()} blocks (~${formatTimeShort(d.seconds)})`;
          statusKlass = 'warn';
        } else if (hasAbsLock) {
          const d = lib.describeAfter ? lib.describeAfter(p.nLockTime) : null;
          if (d && d.kind === 'height') statusLabel = `Activates at block ${d.value.toLocaleString()}`;
          else if (d) statusLabel = `Activates ${new Date(p.nLockTime * 1000).toUTCString().replace('GMT', 'UTC')}`;
          statusKlass = 'warn';
        } else if (hasPreimage) {
          statusLabel = 'Needs preimage';
          statusKlass = 'preimage';
        }
        if (isMalleable) statusKlass = 'bad';

        // Keys row
        const keysHtml = p.sigKeys.length
          ? `<div class="ms-path__keys">${p.sigKeys.map((k) => `<span class="ms-path__key">${SVG_KEY}<code>${escapeHtml(k)}</code></span>`).join('')}</div>`
          : '<div class="ms-path__keys ms-path__keys--none">No signatures required</div>';

        // Preimage chips
        const preimageHtml = p.preimages.length
          ? `<div class="ms-path__keys">${p.preimages.map((pre) => `<span class="ms-path__key ms-path__key--preimage">${SVG_HASH}<code title="${escapeHtml(pre.digest)}">${escapeHtml(pre.hash.toLowerCase())} preimage</code></span>`).join('')}</div>`
          : '';

        // Timeline bar (only when there's a relative timelock, scaled across all paths)
        let timelineHtml = '';
        if (hasRelLock && maxRelativeSecs > 0) {
          const pct = Math.max(8, Math.min(100, (relSecs / maxRelativeSecs) * 100));
          const d = lib.describeOlder ? lib.describeOlder(p.nSequence) : null;
          const dur = d ? formatTimeShort(d.seconds) : '';
          const detail = (d && d.kind === 'blocks') ? `${d.blocks.toLocaleString()} blocks` : (d ? `${d.units} × 512s` : '');
          timelineHtml = `
            <div class="ms-path__timeline" role="img" aria-label="Activation timeline">
              <div class="ms-path__timeline-track">
                <div class="ms-path__timeline-fill" style="width:${pct.toFixed(1)}%"></div>
                <div class="ms-path__timeline-marker" style="left:${pct.toFixed(1)}%"></div>
              </div>
              <div class="ms-path__timeline-axis">
                <span>Funding tx confirms</span>
                <span class="ms-path__timeline-end"><strong>+ ${escapeHtml(dur)}</strong> <span class="ms-path__timeline-detail">${escapeHtml(detail)}</span></span>
              </div>
            </div>`;
        } else if (!hasTimelock && !hasPreimage && !isMalleable) {
          // "Available now" — show a full green bar for visual parity
          timelineHtml = `
            <div class="ms-path__timeline ms-path__timeline--now" role="img" aria-label="Always available">
              <div class="ms-path__timeline-track">
                <div class="ms-path__timeline-fill ms-path__timeline-fill--now" style="width:100%"></div>
              </div>
              <div class="ms-path__timeline-axis"><span>Always available from confirmation</span></div>
            </div>`;
        }

        // Additional textual details (timelock specifics for power users)
        const extras = [];
        if (hasRelLock) {
          const d = lib.describeOlder ? lib.describeOlder(p.nSequence) : null;
          extras.push(`<li><strong>Relative timelock</strong> <code>older(${p.nSequence})</code> - ${d ? escapeHtml(d.label) : 'unknown'}</li>`);
        }
        if (hasAbsLock) {
          const d = lib.describeAfter ? lib.describeAfter(p.nLockTime) : null;
          extras.push(`<li><strong>Absolute timelock</strong> <code>after(${p.nLockTime})</code> - ${d ? escapeHtml(d.label) : 'unknown'}</li>`);
        }
        const extrasHtml = extras.length ? `<ul class="ms-path__extras">${extras.join('')}</ul>` : '';

        return `
          <div class="ms-path ms-path--${category}">
            <div class="ms-path__head">
              <span class="ms-path__idx">Path #${idx}</span>
              <span class="ms-path__status ms-path__status--${statusKlass}">${escapeHtml(statusLabel)}</span>
              ${isMalleable ? '<span class="ms-path__badge ms-path__badge--malleable" title="Witness can be modified by a third party before broadcast">malleable</span>' : ''}
            </div>
            ${timelineHtml}
            ${keysHtml}
            ${preimageHtml}
            ${extrasHtml}
            <details class="ms-path__witness-wrap">
              <summary>Show witness</summary>
              <pre class="ms-path__witness"><code>${escapeHtml(p.asm)}</code></pre>
            </details>
          </div>`;
      };
      spend.nonMalleable.forEach((p, i) => rows.push(render(p, i + 1, false)));
      spend.malleable.forEach((p, i) => rows.push(render(p, spend.nonMalleable.length + i + 1, true)));
      pathsEl.innerHTML = rows.join('');
    }

    function formatTimeShort(seconds) {
      const s = Math.round(seconds);
      if (s < 60) return `${s}s`;
      const m = s / 60;
      if (m < 60) return `${Math.round(m)}m`;
      const h = m / 60;
      if (h < 24) return `${h.toFixed(1)}h`;
      const d = h / 24;
      if (d < 60) return `${Math.round(d)}d`;
      const months = d / 30.44;
      const years = d / 365.25;
      if (years >= 0.95) {
        const wholeY = Math.round(years);
        const extraMo = Math.round((years - wholeY) * 12);
        if (extraMo === 0) return `${wholeY}y`;
        return `${wholeY}y ${extraMo}mo`;
      }
      return `${Math.round(months)}mo`;
    }

    let isReady = false;
    (async () => {
      try {
        await lib.ready;
        isReady = true;
        readyEl.hidden = true;
        compileBtn.disabled = false;
      } catch (e) {
        readyEl.textContent = 'Compiler failed to load: ' + (e.message || e);
      }
    })();
    compileBtn.disabled = true;

    const sectDescriptor = document.getElementById('msSectionDescriptor');
    const sectAddresses  = document.getElementById('msSectionAddresses');
    const outDescriptor  = document.getElementById('msOutDescriptor');
    const keysEl         = document.getElementById('msKeys');
    const addressesEl    = document.getElementById('msAddresses');
    const addrCountEl    = document.getElementById('msAddressCount');
    const addrNetworkEl  = document.getElementById('msAddressNetwork');

    let lastDescriptor = null; // remember to re-derive addresses when count/network changes

    function renderKeys(keys) {
      if (!keys || !keys.length) { keysEl.innerHTML = ''; return; }
      keysEl.innerHTML = '<li class="ms-keys__label">Keys in this descriptor:</li>' + keys.map((k, i) =>
        `<li class="ms-key"><span class="ms-key__placeholder">@${i}</span>
          ${k.masterFingerprint ? `<code class="ms-key__fp">[${escapeHtml(k.masterFingerprint)}]</code>` : ''}
          <code class="ms-key__expr">${escapeHtml(k.keyExpression || '(unknown)')}</code></li>`
      ).join('');
    }

    function renderAddresses(descriptor) {
      addressesEl.innerHTML = '';
      const count = parseInt(addrCountEl.value, 10) || 10;
      const network = addrNetworkEl.value || 'mainnet';
      try {
        const r = lib.deriveAddresses(descriptor, { count, network });
        if (r.error) { addressesEl.innerHTML = `<p class="warning">${escapeHtml(r.error)}</p>`; return; }
        if (r.single) {
          addressesEl.innerHTML = `<div class="ms-addresses__col"><h4>Address (not ranged)</h4><div class="ms-address"><code>${escapeHtml(r.single)}</code></div></div>`;
          return;
        }
        const recvHtml = (r.receive || []).map((a) => a.address
          ? `<div class="ms-address"><span class="ms-address__idx">${a.index}</span><code>${escapeHtml(a.address)}</code></div>`
          : `<div class="ms-address ms-address--err"><span class="ms-address__idx">${a.index}</span><span>${escapeHtml(a.error || 'err')}</span></div>`
        ).join('');
        const changeHtml = (r.change || []).map((a) => a.address
          ? `<div class="ms-address"><span class="ms-address__idx">${a.index}</span><code>${escapeHtml(a.address)}</code></div>`
          : `<div class="ms-address ms-address--err"><span class="ms-address__idx">${a.index}</span><span>${escapeHtml(a.error || 'err')}</span></div>`
        ).join('');
        addressesEl.innerHTML =
          `<div class="ms-addresses__col"><h4>Receive (<code>/0/*</code>)</h4>${recvHtml}</div>` +
          (r.multipath ? `<div class="ms-addresses__col"><h4>Change (<code>/1/*</code>)</h4>${changeHtml}</div>` : '');
      } catch (e) {
        addressesEl.innerHTML = `<p class="warning">${escapeHtml(e.message || String(e))}</p>`;
      }
    }

    const symbolicHint = document.getElementById('msSectionSymbolicHint');

    function doCompile() {
      errEl.classList.add('hidden');
      resultEl.hidden = true;
      sectDescriptor.hidden = true;
      sectAddresses.hidden = true;
      if (symbolicHint) symbolicHint.hidden = true;
      lastDescriptor = null;
      try {
        if (!isReady) throw new Error('Compiler still loading - try again in a moment.');
        const input = (inputEl.value || '').trim();
        if (!input) throw new Error('Enter a Policy, Miniscript, or Descriptor.');
        let mode = modeEl.value;
        let tap  = ctxEl.value === 'tapscript';

        // Auto-detect mode
        if (mode === 'auto') {
          if (lib.looksLikeDescriptor && lib.looksLikeDescriptor(input)) mode = 'descriptor';
          else if (/^(and|or|thresh|pk|pkh|sha256|hash256|ripemd160|hash160|older|after)\b/.test(input) && !/\b(and_v|or_d|or_b|or_c|or_i|and_b|and_or|c:|v:|s:|j:|n:|l:|u:|t:|a:|d:)\b/.test(input)) mode = 'policy';
          else mode = 'miniscript';
        }

        let miniscript, asm, scriptHex, scriptBytes, issane;

        if (mode === 'descriptor') {
          const parsed = lib.parseDescriptor(input);
          if (parsed.error) throw new Error('Descriptor parse error: ' + parsed.error);
          tap = parsed.tapscript;
          ctxEl.value = tap ? 'tapscript' : 'p2wsh';

          // Show descriptor section
          sectDescriptor.hidden = false;
          outDescriptor.value = parsed.descriptor;
          renderKeys(parsed.keys);

          // The expandedMiniscript is the inner miniscript with placeholders (@0, @1, ...).
          // We analyse THAT for sanity/satisfier (lib accepts it).
          miniscript = parsed.expandedMiniscript || parsed.miniscript || '';
          if (!miniscript) throw new Error('Descriptor parsed but no inner miniscript found.');
          const c = lib.compileMiniscript(miniscript, tap);
          asm = c.asm || '';
          scriptHex = c.scriptHex || '';
          scriptBytes = c.scriptBytes;
          sectMs.hidden = false;

          // Show derived addresses if ranged + has real xpubs
          if (parsed.isRanged) {
            sectAddresses.hidden = false;
            // Auto-select the network the descriptor was parsed under
            if (parsed.network && addrNetworkEl) addrNetworkEl.value = parsed.network;
            lastDescriptor = input;
            renderAddresses(input);
          } else if (!parsed.isRanged) {
            // For non-ranged descriptors (single fixed pubkeys), show a single address
            sectAddresses.hidden = false;
            if (parsed.network && addrNetworkEl) addrNetworkEl.value = parsed.network;
            lastDescriptor = input;
            renderAddresses(input);
          }
        } else if (mode === 'policy') {
          const r = tap ? lib.compilePolicyTaproot(input) : lib.compilePolicyP2wsh(input);
          miniscript = r.miniscript;
          asm = r.asm || '';
          scriptHex = r.scriptHex || '';
          scriptBytes = r.scriptBytes;
          issane = r.issane;
          if (!issane || /\[(compile error|taproot rewrite|exception)/i.test(miniscript)) {
            throw new Error('Policy did not compile: ' + miniscript);
          }
          sectMs.hidden = false;
        } else {
          miniscript = input;
          const c = lib.compileMiniscript(input, tap);
          if (c.error) throw new Error('Compile error: ' + c.error);
          asm = c.asm;
          scriptHex = c.scriptHex || '';
          scriptBytes = c.scriptBytes;
          sectMs.hidden = true;
        }

        outMs.value = miniscript;
        outAsm.value = asm;
        if (scriptHex) {
          outHex.value = scriptHex;
          outSize.textContent = `${scriptBytes} bytes`;
        } else {
          outHex.value = '';
          outSize.textContent = 'Substitute symbolic keys (e.g. `A`, `B`, `@0`) with 33-byte hex pubkeys (or 32-byte x-only in Tapscript) to see the raw script hex.';
        }

        // Show the "no addresses" hint when input is symbolic (no descriptor section)
        if (symbolicHint && mode !== 'descriptor') {
          symbolicHint.hidden = false;
        }

        const analysis = lib.analyze(miniscript, tap);
        renderFlags(analysis, scriptBytes);

        let spend = { nonMalleable: [], malleable: [] };
        try { spend = lib.spendPaths(miniscript, tap); }
        catch (e) { /* satisfier can throw on weird input - leave empty */ }
        renderPaths(spend);

        resultEl.hidden = false;
      } catch (e) {
        errEl.textContent = e.message || String(e);
        errEl.classList.remove('hidden');
      }
    }

    addrCountEl.addEventListener('change', () => { if (lastDescriptor) renderAddresses(lastDescriptor); });
    addrNetworkEl.addEventListener('change', () => { if (lastDescriptor) renderAddresses(lastDescriptor); });

    compileBtn.addEventListener('click', doCompile);
    inputEl.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); doCompile(); }
    });

    const demoBanner = document.getElementById('msDemoBanner');
    const demoLabel  = document.getElementById('msDemoLabel');
    const demoClear  = document.getElementById('msDemoClear');

    function showDemoBanner(text) {
      if (!demoBanner) return;
      demoLabel.textContent = text;
      demoBanner.hidden = false;
    }

    view.querySelectorAll('[data-ms-descriptor]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.msDescriptor;
        const sample = (lib.SAMPLE_DESCRIPTORS || []).find((s) => s.id === id);
        if (!sample) return;
        modeEl.value = 'descriptor';
        inputEl.value = sample.descriptor;
        showDemoBanner(`${sample.title} - ${sample.description}`);
        if (isReady) doCompile();
      });
    });

    if (demoClear) {
      demoClear.addEventListener('click', () => {
        inputEl.value = '';
        resultEl.hidden = true;
        errEl.classList.add('hidden');
        demoBanner.hidden = true;
        modeEl.value = 'auto';
      });
    }
  }

  // ----- PSBT Inspector -----------------------------------------------------
  function initPsbtTool() {
    const view = document.querySelector('[data-tool="psbt"]');
    if (!view || !window.psbtInspect) return;

    const inputEl   = document.getElementById('psbtInput');
    const inspectBtn = document.getElementById('psbtInspectBtn');
    const errEl     = document.getElementById('psbtError');
    const resultEl  = document.getElementById('psbtResult');
    const summaryEl = document.getElementById('psbtSummary');
    const inputsEl  = document.getElementById('psbtInputs');
    const outputsEl = document.getElementById('psbtOutputs');
    const inCount   = document.getElementById('psbtInputsCount');
    const outCount  = document.getElementById('psbtOutputsCount');
    const globalEl  = document.getElementById('psbtGlobalXpubs');

    function esc(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function fmtSats(n) {
      if (n === null || n === undefined) return '<em class="psbt-unknown">unknown</em>';
      const bi = typeof n === 'bigint' ? n : BigInt(n);
      const abs = bi < 0n ? -bi : bi;
      const sats = abs.toLocaleString('en-US');
      const btc = (Number(bi) / 1e8).toFixed(8);
      return `${bi < 0n ? '-' : ''}${sats} sats <span class="psbt-btc">(${btc} BTC)</span>`;
    }

    function pill(label, klass) {
      return `<span class="psbt-pill psbt-pill--${klass}">${esc(label)}</span>`;
    }

    function shortHex(h, head, tail) {
      if (!h) return '';
      head = head || 8; tail = tail || 8;
      if (h.length <= head + tail + 3) return h;
      return `${h.slice(0, head)}…${h.slice(-tail)}`;
    }

    function renderSummary(r) {
      const status = r.fullySigned
        ? pill('FULLY SIGNED', 'ok')
        : r.finalizedCount > 0
          ? pill(`${r.finalizedCount}/${r.inputCount} FINALISED`, 'warn')
          : r.signedCount > 0
            ? pill(`${r.signedCount}/${r.inputCount} SIGNED`, 'warn')
            : pill('UNSIGNED', 'info');
      const rows = [
        ['Status', status, true],
        ['Network', `<strong>${esc(r.network)}</strong>`, true],
        ['Tx version', r.txVersion, false],
        ['Locktime', r.locktime, false],
        ['Inputs / outputs', `${r.inputCount} → ${r.outputCount}`, false],
        ['Total input value', fmtSats(r.allInputValuesKnown ? r.totalInputValue : null), true],
        ['Total output value', fmtSats(r.totalOutputValue), true],
        ['Fee', r.fee !== null ? fmtSats(r.fee) : '<em class="psbt-unknown">need full UTXO data</em>', true],
        ['Est. fee rate', r.feeRate !== null ? `~${r.feeRate.toFixed(2)} sats/vB <span class="psbt-btc">(~${r.estimatedVbytes} vbytes est.)</span>` : '<em class="psbt-unknown">unknown</em>', true],
      ];
      summaryEl.innerHTML = rows.map(([label, value, raw]) =>
        `<div class="psbt-summary__row"><span class="psbt-summary__label">${esc(label)}</span><span class="psbt-summary__value">${raw ? value : esc(String(value))}</span></div>`
      ).join('');
    }

    function renderDerivations(derivs, label) {
      if (!derivs || !derivs.length) return '';
      return `<div class="psbt-subsection"><h4>${esc(label)}</h4>` +
        derivs.map((d) =>
          `<div class="psbt-deriv"><code>${esc(d.masterFingerprint || '????????')}</code><code class="psbt-deriv__path">${esc(d.path || '')}</code><code class="psbt-deriv__pubkey" title="${esc(d.pubkey)}">${esc(shortHex(d.pubkey, 10, 10))}</code></div>`
        ).join('') + `</div>`;
    }

    function renderSigs(sigs) {
      if (!sigs || !sigs.length) return '';
      return `<div class="psbt-subsection"><h4>Partial signatures (${sigs.length})</h4>` +
        sigs.map((s) =>
          `<div class="psbt-sig"><code title="${esc(s.pubkey)}">${esc(shortHex(s.pubkey, 10, 8))}</code> <span class="psbt-sig__flag">${esc(s.sighashName || '')}</span><code class="psbt-sig__sig" title="${esc(s.signature)}">${esc(shortHex(s.signature, 12, 12))}</code></div>`
        ).join('') + `</div>`;
    }

    function renderInput(inp) {
      const pills = [];
      pills.push(pill(inp.scriptType, 'type'));
      if (inp.finalized) pills.push(pill('finalised', 'ok'));
      else if (inp.signed) pills.push(pill(`${inp.partialSigs.length} sig${inp.partialSigs.length === 1 ? '' : 's'}`, 'warn'));
      else pills.push(pill('unsigned', 'info'));
      if (!inp.witnessUtxoPresent && !inp.nonWitnessUtxoPresent) pills.push(pill('no UTXO data', 'bad'));
      if (inp.sighashName) pills.push(pill(inp.sighashName, 'info'));

      let scriptInfo = '';
      if (inp.redeemScript) scriptInfo += `<div class="psbt-script"><strong>Redeem script:</strong> <code title="${esc(inp.redeemScript)}">${esc(shortHex(inp.redeemScript, 16, 16))}</code></div>`;
      if (inp.witnessScript) scriptInfo += `<div class="psbt-script"><strong>Witness script:</strong> <code title="${esc(inp.witnessScript)}">${esc(shortHex(inp.witnessScript, 16, 16))}</code></div>`;
      if (inp.tapInternalKey) scriptInfo += `<div class="psbt-script"><strong>Taproot internal key:</strong> <code>${esc(inp.tapInternalKey)}</code></div>`;
      if (inp.tapKeySig) scriptInfo += `<div class="psbt-script"><strong>Taproot key-spend sig:</strong> <code>${esc(shortHex(inp.tapKeySig, 12, 12))}</code></div>`;
      if (inp.tapLeafScripts.length) scriptInfo += `<div class="psbt-script"><strong>Taproot leaves:</strong> ${inp.tapLeafScripts.length}</div>`;

      return `
        <div class="psbt-card">
          <div class="psbt-card__head">
            <div class="psbt-card__title">Input #${inp.index}</div>
            <div class="psbt-pills">${pills.join('')}</div>
          </div>
          <div class="psbt-card__row"><span>Outpoint</span><code title="${esc(inp.prevTxid + ':' + inp.prevVout)}">${esc(shortHex(inp.prevTxid, 12, 12))}:${inp.prevVout}</code></div>
          <div class="psbt-card__row"><span>Sequence</span><code>${inp.sequence}</code> <span class="psbt-btc">(0x${esc(inp.sequenceHex)})</span></div>
          <div class="psbt-card__row"><span>Value</span><span>${fmtSats(inp.valueKnown ? inp.value : null)}</span></div>
          ${inp.address ? `<div class="psbt-card__row"><span>Address</span><code class="psbt-addr">${esc(inp.address)}</code></div>` : ''}
          ${scriptInfo}
          ${renderSigs(inp.partialSigs)}
          ${renderDerivations(inp.derivations, 'BIP-32 derivations')}
          ${renderDerivations(inp.tapDerivations, 'Taproot derivations')}
        </div>`;
    }

    function renderOutput(out) {
      const pills = [pill(out.scriptType, 'type')];
      if (out.likelyChange) pills.push(pill('likely change', 'info'));
      return `
        <div class="psbt-card">
          <div class="psbt-card__head">
            <div class="psbt-card__title">Output #${out.index}</div>
            <div class="psbt-pills">${pills.join('')}</div>
          </div>
          <div class="psbt-card__row"><span>Value</span><span>${fmtSats(out.value)}</span></div>
          ${out.address ? `<div class="psbt-card__row"><span>Address</span><code class="psbt-addr">${esc(out.address)}</code></div>` : ''}
          <div class="psbt-card__row"><span>Script</span><code title="${esc(out.scriptHex)}">${esc(shortHex(out.scriptHex, 14, 14))}</code></div>
          ${out.witnessScript ? `<div class="psbt-script"><strong>Witness script:</strong> <code title="${esc(out.witnessScript)}">${esc(shortHex(out.witnessScript, 14, 14))}</code></div>` : ''}
          ${out.tapInternalKey ? `<div class="psbt-script"><strong>Taproot internal key:</strong> <code>${esc(out.tapInternalKey)}</code></div>` : ''}
          ${renderDerivations(out.derivations, 'BIP-32 derivations')}
          ${renderDerivations(out.tapDerivations, 'Taproot derivations')}
        </div>`;
    }

    function renderGlobalXpubs(xpubs) {
      if (!xpubs || !xpubs.length) { globalEl.innerHTML = ''; return; }
      globalEl.innerHTML = `
        <h3 class="section-heading">Global xpubs <span class="psbt-count">${xpubs.length}</span></h3>
        <div>${xpubs.map((x) =>
          `<div class="psbt-card"><div class="psbt-card__row"><span>Fingerprint</span><code>${esc(x.masterFingerprint)}</code></div><div class="psbt-card__row"><span>Path</span><code>${esc(x.path)}</code></div><div class="psbt-card__row"><span>xpub (hex)</span><code title="${esc(x.extendedPubkey)}">${esc(shortHex(x.extendedPubkey, 16, 16))}</code></div></div>`
        ).join('')}</div>`;
    }

    function inspect() {
      errEl.classList.add('hidden');
      resultEl.hidden = true;
      try {
        const text = (inputEl.value || '').trim();
        if (!text) throw new Error('Paste a PSBT first.');
        const r = window.psbtInspect.inspect(text);
        renderSummary(r);
        inCount.textContent = r.inputCount;
        outCount.textContent = r.outputCount;
        inputsEl.innerHTML = r.inputs.map(renderInput).join('');
        outputsEl.innerHTML = r.outputs.map(renderOutput).join('');
        renderGlobalXpubs(r.globalXpubs);
        resultEl.hidden = false;
      } catch (e) {
        errEl.textContent = e.message || String(e);
        errEl.classList.remove('hidden');
      }
    }

    inspectBtn.addEventListener('click', inspect);
    inputEl.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); inspect(); }
    });

    // --- Demo data ---
    const demoBtn = document.getElementById('psbtDemoBtn');
    const demoBanner = document.getElementById('psbtDemoBanner');
    const demoLabel = document.getElementById('psbtDemoLabel');
    const demoClear = document.getElementById('psbtDemoClear');
    const DEMO_PSBT_B64 = 'cHNidP8BAH0CAAAAAZrrF3JjAW7+42Hakr3Xa0xBzR4Yl01xHRe5q4qDTXs8AAAAAAD/////AmCuCgAAAAAAFgAUwM681sPTyox13F7GLr5VMw75EOJYgAQAAAAAACIAIBPLW8m3PGwweAXY0XY9pq2wIYLtdfvk9eHbOk8ned4YAAAAAAABAF4CAAAAAaqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqAAAAAAD/////AUBCDwAAAAAAIgAgVAWmM5q3iFQvGrJQnLw6Na+2bb/hfZziViWC2y2Bg88AAAAAAQErQEIPAAAAAAAiACBUBaYzmreIVC8aslCcvDo1r7Ztv+F9nOJWJYLbLYGDzyICA9wZU8J1bHxY1PSMobu6dn9BT9I2v01mK2dyGsYmxRTgSDBFAiEAzIcnpNOuEli4CpJeKIvrqDU9YMhUUUoCoTn/YCSlnw8CIDyCaWNDmTcFWxd1BT+2Mn9mNzzgBlzJX+ea0ceHkVhdAQEFaVIhApngq+EjnzSebcNSXcWthMzm5jthxiU9ZHMf7v1QHMaJIQLNxJ453eviqLgvjD+Qx6XuLPBTSsqFZmFXXAsB7PKgoiED3BlTwnVsfFjU9Iyhu7p2f0FP0ja/TWYrZ3IaxibFFOBTriIGA9wZU8J1bHxY1PSMobu6dn9BT9I2v01mK2dyGsYmxRTgHHPF2gowAACAAAAAgAAAAIACAACAAAAAAAAAAAAAAAEBaVIhAmFEARKX/GUSk7wzN0x4iturHYhFHusHyXJdv2+r+cAxIQMcqbobb/xUg8jjd2jaQrTQsALfYWMkaB0a6cJmLqqVtiEDSBw2hYtVX00jJMBVG+Lpk42CijxQABVUmphbvY1vr/5TriICA0gcNoWLVV9NIyTAVRvi6ZONgoo8UAAVVJqYW72Nb6/+HHPF2gowAACAAAAAgAAAAIACAACAAQAAAAAAAAAA';
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        inputEl.value = DEMO_PSBT_B64;
        demoLabel.textContent = '2-of-3 P2WSH multisig, 1 of 2 signatures present.';
        demoBanner.hidden = false;
        inspect();
      });
    }
    if (demoClear) {
      demoClear.addEventListener('click', () => {
        inputEl.value = '';
        resultEl.hidden = true;
        errEl.classList.add('hidden');
        demoBanner.hidden = true;
      });
    }
  }

  // ----- Seed hero (mnemonic cards + first BIP-84 address + QR) -------------
  function initSeedHero() {
    const heroEl = document.getElementById('seedHero');
    const frameEl = document.getElementById('seedHeroFrame');
    const wordsEl = document.getElementById('seedHeroWords');
    const addressEl = document.getElementById('seedHeroAddressValue');
    const qrEl = document.getElementById('seedHeroQr');
    if (!heroEl || !wordsEl || !addressEl || !qrEl) return;

    const NUMBER_WORDS = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty','twenty-one','twenty-two','twenty-three','twenty-four'];

    let lastRendered = '';

    function renderWords(words) {
      wordsEl.innerHTML = '';
      words.forEach((w, i) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'seed-hero__word';
        card.style.animationDelay = `${i * 40}ms`;
        card.innerHTML = `<span class="seed-hero__word-num">${i + 1}</span><span class="seed-hero__word-text">${w}</span>`;
        card.addEventListener('click', () => {
          if (navigator.clipboard) navigator.clipboard.writeText(w).catch(() => {});
          card.classList.add('is-copied');
          setTimeout(() => card.classList.remove('is-copied'), 900);
        });
        wordsEl.appendChild(card);
      });
    }

    function renderQr(address) {
      qrEl.innerHTML = '';
      if (!address || typeof QRCode === 'undefined') return;
      try {
        const qr = new QRCode(0, 'L');
        qr.addData(address.toUpperCase()); // bech32 is case-insensitive; uppercase gives a smaller QR
        qr.make();
        qrEl.innerHTML = qr.createSvgTag({ cellSize: 4, scalable: true });
      } catch (e) {
        qrEl.textContent = '';
      }
    }

    function deriveFirstBip84(mnemonic, passphrase) {
      try {
        if (!window.bip39 || !window.bip32 || !window.bitcoin) return null;
        const seed = window.bip39.mnemonicToSeedSync(mnemonic, passphrase || '');
        const root = window.bip32.fromSeed(seed);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        const { address } = window.bitcoin.payments.p2wpkh({
          pubkey: child.publicKey,
          network: window.bitcoin.networks.bitcoin,
        });
        return address;
      } catch (e) {
        return null;
      }
    }

    function refresh() {
      const phraseEl = document.getElementById('bip39Phrase');
      const passEl = document.getElementById('bip39Passphrase');
      const phrase = (phraseEl && phraseEl.value || '').trim();
      const passphrase = (passEl && passEl.value || '');

      if (!phrase) {
        heroEl.hidden = true;
        lastRendered = '';
        return;
      }
      const words = phrase.split(/\s+/).filter(Boolean);
      if (![12, 15, 18, 21, 24].includes(words.length)) {
        heroEl.hidden = true;
        lastRendered = '';
        return;
      }
      // Validate
      if (window.bip39 && !window.bip39.validateMnemonic(phrase)) {
        heroEl.hidden = true;
        lastRendered = '';
        return;
      }

      const key = `${phrase}|${passphrase}|${words.length}`;
      if (key === lastRendered) return;
      lastRendered = key;

      const numberWord = NUMBER_WORDS[words.length] || `${words.length}`;
      const passNote = passphrase ? ' (with your passphrase applied)' : '';
      frameEl.innerHTML = `These <strong>${numberWord} words</strong> are your wallet${passNote}. Anyone who has them can recreate it - and only them. The first Bitcoin address they generate is shown alongside.`;

      renderWords(words);

      const address = deriveFirstBip84(phrase, passphrase);
      if (address) {
        addressEl.textContent = address;
        addressEl.onclick = () => {
          if (navigator.clipboard) navigator.clipboard.writeText(address).catch(() => {});
          addressEl.classList.add('is-copied');
          setTimeout(() => addressEl.classList.remove('is-copied'), 900);
        };
        renderQr(address);
      } else {
        addressEl.textContent = '(could not derive)';
        qrEl.innerHTML = '';
      }

      heroEl.hidden = false;
    }

    document.addEventListener('seedtool:seed-changed', refresh);
    // Also poll lightly to catch passphrase changes that don't trigger a root-key change observable to refreshSeedBar yet
    setInterval(refresh, 700);
    refresh();
  }

  // ----- Collapsible long entropy values -------------------------------------
  function initEntropyCollapsible() {
    const THRESHOLD = 80;
    document.querySelectorAll('[data-ed-toggle]').forEach((btn) => {
      const target = document.getElementById(btn.dataset.edToggle);
      if (!target) return;

      const syncLabel = () => {
        btn.textContent = target.classList.contains('is-truncated') ? 'Show all' : 'Show less';
      };

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (target.classList.contains('is-truncated')) {
          target.classList.remove('is-truncated');
          target.dataset.edUserExpanded = '1';
        } else {
          target.classList.add('is-truncated');
          delete target.dataset.edUserExpanded;
        }
        syncLabel();
      });

      const update = () => {
        const len = (target.textContent || '').length;
        if (len > THRESHOLD) {
          if (!target.dataset.edUserExpanded) target.classList.add('is-truncated');
          btn.classList.remove('hidden');
          syncLabel();
        } else {
          target.classList.remove('is-truncated');
          btn.classList.add('hidden');
          delete target.dataset.edUserExpanded;
        }
      };

      new MutationObserver(update).observe(target, { characterData: true, childList: true, subtree: true });
      update();
    });
  }

  // ----- BIP-353 DNS Payment Helper -----------------------------------------
  function initBip353Tool() {
    const view = document.querySelector('[data-tool="bip353"]');
    if (!view) return;

    function esc(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function normName(s) { return (s || '').trim().toLowerCase().replace(/^[₿]/, '').replace(/^@/, ''); }
    function normDomain(s) { return (s || '').trim().toLowerCase().replace(/^@/, ''); }
    function fqdn(name, domain) {
      if (!name && !domain) return '';
      return `${name || '<name>'}.user._bitcoin-payment.${domain || '<domain>'}`;
    }

    // Live FQDN preview
    const nameEl = document.getElementById('b353Name');
    const domainEl = document.getElementById('b353Domain');
    const fqdnPreview = document.getElementById('b353Fqdn');
    function updateFqdnPreview() {
      const n = normName(nameEl.value);
      const d = normDomain(domainEl.value);
      fqdnPreview.textContent = fqdn(n, d);
    }
    nameEl.addEventListener('input', updateFqdnPreview);
    domainEl.addEventListener('input', updateFqdnPreview);

    // ---- BUILD ----
    const buildBtn = document.getElementById('b353BuildBtn');
    const buildErr = document.getElementById('b353BuildError');
    const buildRes = document.getElementById('b353BuildResult');
    const outUri = document.getElementById('b353OutUri');
    const outFqdn = document.getElementById('b353OutFqdn');
    const outTxt = document.getElementById('b353OutTxt');
    const outIdentifier = document.getElementById('b353OutIdentifier');

    function buildUri() {
      buildErr.classList.add('hidden');
      buildRes.hidden = true;
      try {
        const sp      = (document.getElementById('b353Sp').value || '').trim();
        const offer   = (document.getElementById('b353Offer').value || '').trim();
        const onchain = (document.getElementById('b353Onchain').value || '').trim();
        const amount  = (document.getElementById('b353Amount').value || '').trim();
        const label   = (document.getElementById('b353Label').value || '').trim();
        const message = (document.getElementById('b353Message').value || '').trim();
        const name    = normName(nameEl.value);
        const domain  = normDomain(domainEl.value);

        if (!sp && !offer && !onchain) {
          throw new Error('Provide at least one payment endpoint (Silent Payment, BOLT-12 offer, or on-chain address).');
        }
        if (!name || !domain) {
          throw new Error('Enter both a name and a domain for the identifier.');
        }
        if (sp && !/^t?sp1q/i.test(sp)) throw new Error('Silent Payment address should start with sp1q or tsp1q.');
        if (offer && !/^lno1/i.test(offer)) throw new Error('BOLT-12 offer should start with lno1.');
        if (amount && !/^\d+(\.\d+)?$/.test(amount)) throw new Error('Amount must be a positive decimal number in BTC.');

        // Build BIP-21 URI
        const params = new URLSearchParams();
        if (amount)  params.append('amount', amount);
        if (label)   params.append('label', label);
        if (message) params.append('message', message);
        if (sp)      params.append('sp', sp);
        if (offer)   params.append('lno', offer);

        // URLSearchParams encodes spaces as `+`, BIP-21 expects %20 — patch.
        const qs = params.toString().replace(/\+/g, '%20');
        const uri = `bitcoin:${onchain}${qs ? '?' + qs : ''}`;

        const recordName = fqdn(name, domain);
        outUri.value = uri;
        outFqdn.textContent = recordName;
        outTxt.value = `"${uri}"`;
        outIdentifier.textContent = `${name}@${domain}`;
        buildRes.hidden = false;
      } catch (e) {
        buildErr.textContent = e.message || String(e);
        buildErr.classList.remove('hidden');
      }
    }
    buildBtn.addEventListener('click', buildUri);

    // ---- Demo data (Build) ----
    const buildDemoBtn = document.getElementById('b353BuildDemoBtn');
    const buildDemoBanner = document.getElementById('b353BuildDemoBanner');
    const buildDemoLabel = document.getElementById('b353BuildDemoLabel');
    const buildDemoClear = document.getElementById('b353BuildDemoClear');
    if (buildDemoBtn) {
      buildDemoBtn.addEventListener('click', () => {
        nameEl.value = 'satoshi';
        domainEl.value = 'example.com';
        document.getElementById('b353Sp').value = 'sp1qqgste7k9hx0qftg6qmwlkqtwuy6cycyavzmzj6h6arvny8jzzfsq6e9twfpvpcrcqcch9yfff5gmag5amf2dcfsvquxx2jzftqmjuk7v97a4uda';
        document.getElementById('b353Offer').value = 'lno1pgqppmsrse80qf0aara4slvcjxrvu6j2rp5ftmjy4yntlsmsutpkvkt6878sxn8g96fuzlhw75hendmuhjy0gp607tsgzaasdvjmstcwcgc6vgwyqgp6mv9u948ngt3j0urev4ga0vw06cpvasexgn00feez9vfgdkyykfgqxdaa8ysjuy8um26ekywlceecwalj0zvqu5h0dd486uhhzvj9m3qlnmaa9awj0cft7x95h7yn9vaep4gm055q8rsctl6lthka2htmk8pzxvgyzae72gnapuhg2v9rtgwfg4mlr56lqqerat2vv2u2aka8e592vqluf5erqqs2ve30snd2pr2d0h7fdfl9js6wyzjl4c66nu6d32nj4w2ft0um9q4q';
        document.getElementById('b353Onchain').value = 'bc1pyys36jag8qug09c36d9j6427kny3d0x08u3wf5l89sks5sxyq3fsp2vddt';
        document.getElementById('b353Amount').value = '0.001';
        document.getElementById('b353Label').value = 'Donations';
        document.getElementById('b353Message').value = 'Thanks!';
        updateFqdnPreview();
        buildDemoLabel.textContent = '"satoshi@example.com" with a Silent Payment address, BOLT-12 offer, and on-chain Taproot fallback.';
        buildDemoBanner.hidden = false;
        buildUri();
      });
    }
    if (buildDemoClear) {
      buildDemoClear.addEventListener('click', () => {
        ['b353Name','b353Domain','b353Sp','b353Offer','b353Onchain','b353Amount','b353Label','b353Message'].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        updateFqdnPreview();
        buildRes.hidden = true;
        buildErr.classList.add('hidden');
        buildDemoBanner.hidden = true;
      });
    }

    // ---- INSPECT ----
    const inspectBtn = document.getElementById('b353InspectBtn');
    const inspectInput = document.getElementById('b353InspectInput');
    const inspectErr = document.getElementById('b353InspectError');
    const inspectRes = document.getElementById('b353InspectResult');
    const inspectFields = document.getElementById('b353InspectFields');

    const PARAM_LABELS = {
      amount:  'Amount (BTC)',
      label:   'Label',
      message: 'Message',
      sp:      'Silent Payment address',
      lno:     'BOLT-12 offer',
      lightning: 'BOLT-11 invoice',
      r:       'Payment Protocol URL (BIP-72)',
      pj:      'PayJoin endpoint',
      pjos:    'PayJoin output substitution',
    };

    function row(label, value, opts) {
      opts = opts || {};
      const cls = opts.mono ? 'b353-row b353-row--mono' : 'b353-row';
      return `<div class="${cls}"><span class="b353-row__label">${esc(label)}</span><div class="b353-row__value"><code>${esc(value)}</code></div></div>`;
    }

    function doInspect() {
      inspectErr.classList.add('hidden');
      inspectRes.hidden = true;
      try {
        let raw = (inspectInput.value || '').trim();
        if (!raw) throw new Error('Paste a bitcoin: URI first.');
        // Strip any surrounding quotes (TXT record values often come quoted).
        raw = raw.replace(/^"+|"+$/g, '').trim();
        if (!/^bitcoin:/i.test(raw)) throw new Error('Not a bitcoin: URI (must start with "bitcoin:").');

        // Manual split because URL constructor on bitcoin: scheme is unreliable.
        const afterScheme = raw.slice('bitcoin:'.length);
        const qIdx = afterScheme.indexOf('?');
        const address = qIdx === -1 ? afterScheme : afterScheme.slice(0, qIdx);
        const query   = qIdx === -1 ? '' : afterScheme.slice(qIdx + 1);

        const params = new URLSearchParams(query);
        const parts = [];
        if (address) parts.push(row('On-chain address', address, { mono: true }));

        const known = ['amount', 'label', 'message', 'sp', 'lno', 'lightning', 'r', 'pj', 'pjos'];
        for (const k of known) {
          if (params.has(k)) {
            const v = params.get(k);
            parts.push(row(PARAM_LABELS[k] || k, v, { mono: !['amount','label','message'].includes(k) }));
          }
        }
        // Surface unknown params too
        for (const [k, v] of params.entries()) {
          if (!known.includes(k)) parts.push(row(`Unknown (${k})`, v, { mono: true }));
        }

        // Quick cross-links if we found Lightning / Silent Payment endpoints
        const links = [];
        if (params.has('sp'))  links.push('<a href="#/silent" class="btn">Open Silent Payments tool →</a>');
        if (params.has('lno') || params.has('lightning')) links.push('<a href="#/lightning" class="btn">Open Lightning decoder →</a>');
        if (links.length) parts.push(`<div class="b353-actions">${links.join('')}</div>`);

        if (!parts.length) throw new Error('URI has no recognisable fields (no address, no parameters).');
        inspectFields.innerHTML = parts.join('');
        inspectRes.hidden = false;
      } catch (e) {
        inspectErr.textContent = e.message || String(e);
        inspectErr.classList.remove('hidden');
      }
    }
    inspectBtn.addEventListener('click', doInspect);
    inspectInput.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); doInspect(); }
    });

    // ---- Demo data (Inspect) ----
    const inspectDemoBtn = document.getElementById('b353InspectDemoBtn');
    const inspectDemoBanner = document.getElementById('b353InspectDemoBanner');
    const inspectDemoLabel = document.getElementById('b353InspectDemoLabel');
    const inspectDemoClear = document.getElementById('b353InspectDemoClear');
    if (inspectDemoBtn) {
      inspectDemoBtn.addEventListener('click', () => {
        inspectInput.value = 'bitcoin:bc1pyys36jag8qug09c36d9j6427kny3d0x08u3wf5l89sks5sxyq3fsp2vddt?amount=0.001&label=Donations&message=Thanks%21&sp=sp1qqgste7k9hx0qftg6qmwlkqtwuy6cycyavzmzj6h6arvny8jzzfsq6e9twfpvpcrcqcch9yfff5gmag5amf2dcfsvquxx2jzftqmjuk7v97a4uda&lno=lno1pgqppmsrse80qf0aara4slvcjxrvu6j2rp5ftmjy4yntlsmsutpkvkt6878sxn8g96fuzlhw75hendmuhjy0gp607tsgzaasdvjmstcwcgc6vgwyqgp6mv9u948ngt3j0urev4ga0vw06cpvasexgn00feez9vfgdkyykfgqxdaa8ysjuy8um26ekywlceecwalj0zvqu5h0dd486uhhzvj9m3qlnmaa9awj0cft7x95h7yn9vaep4gm055q8rsctl6lthka2htmk8pzxvgyzae72gnapuhg2v9rtgwfg4mlr56lqqerat2vv2u2aka8e592vqluf5erqqs2ve30snd2pr2d0h7fdfl9js6wyzjl4c66nu6d32nj4w2ft0um9q4q';
        inspectDemoLabel.textContent = 'A "bitcoin:" URI with Taproot, Silent Payment, and BOLT-12 endpoints plus amount + label.';
        inspectDemoBanner.hidden = false;
        doInspect();
      });
    }
    if (inspectDemoClear) {
      inspectDemoClear.addEventListener('click', () => {
        inspectInput.value = '';
        inspectRes.hidden = true;
        inspectErr.classList.add('hidden');
        inspectDemoBanner.hidden = true;
      });
    }

    // ---- RESOLVE (online opt-in via DoH) ----
    const resolveBtn = document.getElementById('b353ResolveBtn');
    const resNameEl = document.getElementById('b353ResName');
    const resDomainEl = document.getElementById('b353ResDomain');
    const resolverEl = document.getElementById('b353ResResolver');
    const resErr = document.getElementById('b353ResolveError');
    const resRes = document.getElementById('b353ResolveResult');
    const resFlagsEl = document.getElementById('b353ResolveFlags');
    const resTxtEl = document.getElementById('b353ResolveTxt');
    const resFieldsEl = document.getElementById('b353ResolveFields');

    function decodeUriToFields(uri) {
      const parts = [];
      if (!/^bitcoin:/i.test(uri)) return parts;
      const afterScheme = uri.slice('bitcoin:'.length);
      const qIdx = afterScheme.indexOf('?');
      const address = qIdx === -1 ? afterScheme : afterScheme.slice(0, qIdx);
      const query   = qIdx === -1 ? '' : afterScheme.slice(qIdx + 1);
      const params = new URLSearchParams(query);
      if (address) parts.push(row('On-chain address', address, { mono: true }));
      const known = ['amount','label','message','sp','lno','lightning','r','pj','pjos'];
      for (const k of known) {
        if (params.has(k)) parts.push(row(PARAM_LABELS[k] || k, params.get(k), { mono: !['amount','label','message'].includes(k) }));
      }
      for (const [k, v] of params.entries()) {
        if (!known.includes(k)) parts.push(row(`Unknown (${k})`, v, { mono: true }));
      }
      return parts;
    }

    async function doResolve() {
      resErr.classList.add('hidden');
      resRes.hidden = true;
      try {
        const name = normName(resNameEl.value);
        const domain = normDomain(resDomainEl.value);
        if (!name || !domain) throw new Error('Enter both a name and a domain.');
        const queryName = fqdn(name, domain);
        const resolverUrl = resolverEl.value;
        const url = `${resolverUrl}?name=${encodeURIComponent(queryName)}&type=TXT`;
        let resp;
        try {
          resp = await fetch(url, { headers: { 'Accept': 'application/dns-json' } });
        } catch (e) {
          throw new Error('Network error: ' + (e.message || e) + '. Are you offline?');
        }
        if (!resp.ok) throw new Error(`Resolver returned ${resp.status} ${resp.statusText}`);
        const data = await resp.json();

        const flags = [];
        const ok   = (l) => `<li class="ms-flag ms-flag--ok"><span class="ms-flag__dot"></span> ${esc(l)}</li>`;
        const bad  = (l) => `<li class="ms-flag ms-flag--bad"><span class="ms-flag__dot"></span> ${esc(l)}</li>`;
        const warn = (l) => `<li class="ms-flag ms-flag--warn"><span class="ms-flag__dot"></span> ${esc(l)}</li>`;

        flags.push(data.Status === 0 ? ok(`Status: NOERROR (0)`) : bad(`Status: ${data.Status} (DNS error)`));
        flags.push(data.AD ? ok('DNSSEC validated (AD bit set)') : warn('Not DNSSEC-validated - BIP-353 requires DNSSEC. Treat with caution.'));
        flags.push(data.RA ? ok('Recursive resolver') : warn('No recursion available'));
        if (data.Answer && data.Answer.length) flags.push(ok(`Answer count: ${data.Answer.length}`));
        else flags.push(bad('No TXT record found at this name'));
        resFlagsEl.innerHTML = flags.join('');

        // Find the first TXT answer whose value starts with bitcoin:
        const answers = (data.Answer || []).filter((a) => a.type === 16);
        let txt = '';
        for (const a of answers) {
          // Cloudflare returns the raw TXT record string (each chunk wrapped in quotes, concatenated).
          // Strip outer quotes, also concatenate any internal "" "" splits.
          let v = String(a.data || '').trim();
          v = v.replace(/^"+|"+$/g, '').replace(/"\s*"/g, '');
          if (/^bitcoin:/i.test(v)) { txt = v; break; }
        }
        if (!txt && answers.length) {
          // Show the first TXT anyway, even if it doesn't start with bitcoin:
          txt = String(answers[0].data || '').replace(/^"+|"+$/g, '').replace(/"\s*"/g, '');
        }

        resTxtEl.value = txt;
        if (txt && /^bitcoin:/i.test(txt)) {
          resFieldsEl.innerHTML = decodeUriToFields(txt).join('');
        } else if (txt) {
          resFieldsEl.innerHTML = `<p class="warning">Found a TXT record but it doesn't begin with <code>bitcoin:</code>. Probably not a BIP-353 record.</p>`;
        } else {
          resFieldsEl.innerHTML = '';
        }
        resRes.hidden = false;
      } catch (e) {
        resErr.textContent = e.message || String(e);
        resErr.classList.remove('hidden');
      }
    }

    resolveBtn.addEventListener('click', doResolve);

    updateFqdnPreview();
  }

  // ----- Boot ----------------------------------------------------------------
  function boot() {
    applyDismissed();
    refreshLockState();
    refreshSeedBar();
    initMessageTool();
    initRecoverTool();
    initSilentTool();
    initShamirTool();
    initLabelsTool();
    initLightningTool();
    initMiniscriptTool();
    initPsbtTool();
    initBip353Tool();
    initEntropyCollapsible();
    initSeedHero();
    updateWalkthroughBindings();
    applyRoute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
