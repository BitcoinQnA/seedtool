// Bundle miniscript policy + analyser into js/lib/miniscript.js
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

esbuild.build({
  entryPoints: ['src/www/js/lib/_miniscript_entry.js'],
  bundle: true,
  format: 'iife',
  globalName: '__miniscriptBundle',
  minify: true,
  target: 'es2020',
  outfile: 'src/www/js/lib/miniscript.js',
  plugins: [
    polyfillNode({
      globals: { buffer: true, process: true },
      polyfills: { crypto: true, buffer: true, process: true, util: true, stream: true, events: true, string_decoder: true, assert: true, path: true, fs: false },
    }),
  ],
  define: { 'global': 'globalThis' },
  // Stub out the optional Ledger client - we never use it in the browser.
  alias: { '@ledgerhq/ledger-bitcoin': './build_stub_empty.js' },
}).then(() => console.log('miniscript.js bundled'))
  .catch((e) => { console.error(e); process.exit(1); });
