/*
 * Regression tests for stale and discarded output in the entropy panel.
 *
 * Two behaviours are covered:
 *
 * 1. When entropy cannot produce a mnemonic, nothing derived from a previous
 *    entropy value may be left on screen. This is the display half of issue
 *    #76: the phrase, its QR, checksum, addresses and keys used to survive an
 *    early return and be shown as if they were current.
 *
 * 2. Clearing those fields must not escalate into resetEverything(). That
 *    function also discards input the user typed themselves, on other panels,
 *    which has nothing to do with the entropy being edited.
 *
 * dom.js is browser code, so it is evaluated in a vm against a small DOM
 * stand-in built from the ids in dev.html. The stand-in only implements what
 * dom.js touches; it is not a browser, and it deliberately does not try to be.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WWW = path.join(__dirname, '..', 'src', 'www');

// Scripts the page loads, in the order dev.html loads them.
const LIB_SCRIPTS = [
  'lib/bitcoin.js',
  'lib/bip32.js',
  'lib/bip39.js',
  'lib/bip47.js',
  'lib/bip85.js',
  'lib/bip86.js',
  'lib/bs58check.js',
  'lib/buffer.js',
  'lib/diceware.js',
  'info.js',
  'lib/entropy.js',
  'lib/levenshtein.js',
  'lib/zxcvbn.js',
  'lib/qrcode.js',
];

const makeElement = (id) => {
  const el = {
    id,
    value: '',
    innerText: '',
    innerHTML: '',
    textContent: '',
    style: {},
    firstChild: null,
    firstElementChild: null,
    lastChild: null,
    children: [],
    readOnly: false,
    options: [],
    selectedIndex: 0,
    dataset: {},
    classList: {
      names: new Set(['hidden']),
      add(name) {
        this.names.add(name);
      },
      remove(name) {
        this.names.delete(name);
      },
      toggle(name, force) {
        force ? this.names.add(name) : this.names.delete(name);
      },
      contains(name) {
        return this.names.has(name);
      },
    },
    appendChild() {},
    removeChild() {},
    insertBefore() {},
    append() {},
    prepend() {},
    replaceChildren() {},
    cloneNode: () => makeElement(id),
    closest: () => null,
    matches: () => false,
    contains: () => false,
    scrollIntoView() {},
    select() {},
    setSelectionRange() {},
    blur() {},
    addEventListener() {},
    removeEventListener() {},
    getAttribute() {
      return null;
    },
    setAttribute(name) {
      if (name === 'readonly') el.readOnly = true;
    },
    removeAttribute(name) {
      if (name === 'readonly') el.readOnly = false;
    },
    querySelector: () => makeElement('stub'),
    querySelectorAll: () => [],
    getContext: () => null,
    focus() {},
    click() {},
    remove() {},
    // <template> elements are cloned to build rows and QR icons
    get content() {
      return { firstElementChild: { cloneNode: () => makeElement('clone') } };
    },
  };
  return el;
};

// Build a context with every id dev.html declares, so setupDom finds them all.
const loadTool = () => {
  const html = fs.readFileSync(path.join(WWW, 'dev.html'), 'utf8');
  const elements = {};
  for (const match of html.matchAll(/id="([^"]+)"/g)) {
    elements[match[1]] = makeElement(match[1]);
  }
  // Take each select's starting value from its selected option, and each
  // input's from its value attribute, so the stand-in begins where the page
  // does. Derivation paths and BIP85 fields are built from these.
  for (const match of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const [, id, body] = match;
    const selected = body.match(/<option\b[^>]*\bvalue="([^"]*)"[^>]*\bselected\b/);
    const first = body.match(/<option\b[^>]*\bvalue="([^"]*)"/);
    if (selected || first) elements[id].value = (selected || first)[1];
  }
  for (const match of html.matchAll(/<input\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const value = match[0].match(/\bvalue="([^"]*)"/);
    if (value) elements[match[1]].value = value[1];
  }

  // dom.js debounces background work on timers. Once an interaction has been
  // awaited, anything still pending is deferred work that a real browser would
  // run later; leaving it to fire mid-assertion makes the run nondeterministic.
  const pendingTimers = new Set();
  const cancelPendingTimers = () => {
    for (const id of pendingTimers) clearTimeout(id);
    pendingTimers.clear();
  };

  const document = {
    getElementById: (id) => elements[id] || (elements[id] = makeElement(id)),
    querySelector: () => makeElement('stub'),
    querySelectorAll: () => [],
    getElementsByClassName: () => [],
    createElement: (tag) => {
      const el = makeElement(tag);
      // thisBrowserIsShit() probes for template support
      if (tag === 'template') el.content = makeElement('fragment');
      return el;
    },
    addEventListener() {},
    body: makeElement('body'),
    head: makeElement('head'),
    documentElement: makeElement('html'),
  };

  const context = {
    document,
    console,
    TextEncoder,
    Buffer,
    BigInt,
    Math,
    JSON,
    Date,
    URL,
    Blob: class {},
    setTimeout: (fn, delay) => {
      const id = setTimeout(() => {
        pendingTimers.delete(id);
        fn();
      }, delay || 0);
      pendingTimers.add(id);
      return id;
    },
    clearTimeout: (id) => {
      pendingTimers.delete(id);
      clearTimeout(id);
    },
    setInterval: () => 0,
    clearInterval() {},
    requestAnimationFrame: () => 0,
    navigator: { clipboard: {} },
    location: { href: '', search: '' },
    crypto: require('crypto').webcrypto,
    alert() {},
    fetch: async () => ({ json: async () => ({}) }),
    addEventListener() {},
    removeEventListener() {},
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
  };
  context.window = context;
  context.globalThis = context;
  context.self = context;
  vm.createContext(context);

  for (const script of LIB_SCRIPTS) {
    vm.runInContext(fs.readFileSync(path.join(WWW, 'js', script), 'utf8'),
      context, { filename: script });
  }
  vm.runInContext(fs.readFileSync(path.join(WWW, 'js', 'dom.js'), 'utf8'),
    context, { filename: 'dom.js' });

  return {
    context,
    document,
    cancelPendingTimers,
    DOM: vm.runInContext('DOM', context),
  };
};

// A fresh tool, sitting on the Input Entropy tab with binary entropy selected.
const openEntropyPanel = async (mnemonicLength) => {
  const tool = loadTool();
  await vm.runInContext('setupDom', tool.context)();
  tool.cancelPendingTimers();
  assert.ok(tool.DOM.entropyInput, 'setupDom did not populate DOM');
  // The Input Entropy tab makes the phrase read only; resetEverything()
  // checks this before touching the entropy box.
  tool.DOM.bip39Phrase.setAttribute('readonly', 'true');
  tool.DOM.entropyMnemonicLengthSelect.value = mnemonicLength;
  tool.DOM.entropyMethod.value = 'binary';
  const entropyChanged = vm.runInContext('entropyChanged', tool.context);
  // Settle each interaction the way the page would between keystrokes.
  tool.entropyChanged = async () => {
    await entropyChanged();
    tool.cancelPendingTimers();
  };
  return tool;
};

// Input the user typed themselves, on panels unrelated to the entropy box.
const OWN_INPUT = {
  bip85Index: '7',
  bip85MnemonicLength: '24',
  otpKey: 'user supplied one time pad key',
  otpCipherText: 'user supplied cipher text',
  bip47CPPaymentCode: 'user supplied counterparty payment code',
};
const setOwnInput = (document) => {
  for (const [id, value] of Object.entries(OWN_INPUT)) {
    document.getElementById(id).value = value;
  }
};
const assertOwnInputSurvives = (document) => {
  for (const [id, value] of Object.entries(OWN_INPUT)) {
    assert.strictEqual(
      document.getElementById(id).value,
      value,
      `${id} was discarded`
    );
  }
};

let failures = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// dom.js runs debounced work on a timer that the stand-in cannot satisfy.
// Those failures are background noise, not the behaviour under test.
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

test('raw: entropy that cannot make a mnemonic clears the old phrase',
  async () => {
    const { DOM, entropyChanged } = await openEntropyPanel('raw');

    DOM.entropyInput.value = '1'.repeat(64) + '0'.repeat(64); // 128 bits
    await entropyChanged();
    assert.strictEqual(
      DOM.bip39Phrase.value.split(' ').length,
      12,
      '128 bits of raw entropy should make a 12 word phrase'
    );

    DOM.entropyInput.value += '1'; // 129 bits, no longer a multiple of 32
    await entropyChanged();
    assert.strictEqual(DOM.bip39Phrase.value, '', 'stale phrase left on screen');
    assert.strictEqual(DOM.bip39Seed.value, '', 'stale seed left on screen');
    assert.strictEqual(DOM.bip32RootKey.value, '', 'stale root key left on screen');
    assert.strictEqual(DOM.entropyBinaryChecksum.innerText, '', 'stale checksum');
    assert.strictEqual(DOM.entropyWordIndexes.innerText, '', 'stale word indexes');
  });

test('raw: clearing the phrase keeps the entropy the user is typing',
  async () => {
    const { DOM, entropyChanged } = await openEntropyPanel('raw');
    DOM.entropyInput.value = '1'.repeat(64) + '0'.repeat(64);
    await entropyChanged();
    DOM.entropyInput.value += '1';
    await entropyChanged();
    assert.strictEqual(
      DOM.entropyInput.value.length,
      129,
      'the entropy box was emptied while the user was typing'
    );
  });

test('raw: clearing the phrase keeps input from other panels', async () => {
  const { DOM, document, entropyChanged } = await openEntropyPanel('raw');
  DOM.entropyInput.value = '1'.repeat(64) + '0'.repeat(64);
  await entropyChanged();
  setOwnInput(document);
  DOM.entropyInput.value += '1';
  await entropyChanged();
  assertOwnInputSurvives(document);
});

test('raw: each supported length, and the bit after it, keeps other input',
  async () => {
    const { DOM, document, entropyChanged } = await openEntropyPanel('raw');
    const words = { 128: 12, 160: 15, 192: 18, 224: 21, 256: 24 };

    for (const bits of Object.keys(words).map(Number)) {
      setOwnInput(document);

      DOM.entropyInput.value = '1'.repeat(bits);
      await entropyChanged();
      assert.strictEqual(
        DOM.bip39Phrase.value.split(' ').length,
        words[bits],
        `${bits} bits should make a ${words[bits]} word phrase`
      );

      // One more bit and the length is no longer a multiple of 32. Past 256
      // the surplus is sliced off instead, so the phrase stands.
      DOM.entropyInput.value += '1';
      await entropyChanged();
      if (bits === 256) {
        assert.strictEqual(
          DOM.bip39Phrase.value.split(' ').length,
          24,
          'bits past 256 are discarded, the phrase should be unaffected'
        );
      } else {
        assert.strictEqual(
          DOM.bip39Phrase.value,
          '',
          `stale phrase left on screen at ${bits + 1} bits`
        );
      }
      assertOwnInputSurvives(document);
    }
  });

test('word count: entropy too weak for the selection clears the old phrase',
  async () => {
    const { DOM, document, entropyChanged } = await openEntropyPanel('24');

    DOM.entropyInput.value = '1'.repeat(256);
    await entropyChanged();
    assert.strictEqual(
      DOM.bip39Phrase.value.split(' ').length,
      24,
      '256 bits should make a 24 word phrase'
    );

    setOwnInput(document);
    DOM.entropyInput.value = '1'.repeat(64); // far too little for 24 words
    await entropyChanged();
    assert.ok(
      !DOM.entropyWeakEntropyOverrideWarning.classList.contains('hidden'),
      'the weak entropy warning should be showing'
    );
    assert.strictEqual(
      DOM.bip39Phrase.value,
      '',
      'a phrase from stronger entropy was left beside the weak entropy warning'
    );
    assertOwnInputSurvives(document);
  });

(async () => {
  console.log('entropy panel staleness');
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  ok  ${name}`);
    } catch (err) {
      failures += 1;
      console.error(`  FAIL ${name}`);
      console.error(`       ${err.message}`);
    }
  }
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log('\nall tests passed');
})();
