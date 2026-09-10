/*
 * Loads dom.js, and the libraries it needs, into a vm against a small DOM
 * stand-in built from the ids in dev.html. The stand-in only implements
 * what dom.js touches; it is not a browser, and it deliberately does not
 * try to be.
 */

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

module.exports = { loadTool };
