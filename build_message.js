// Bundle src/www/js/lib/_message_entry.js → src/www/js/lib/message.js using
// esbuild + node-polyfill. Run via `node build_message.js`.
//
// bitcoinjs-message and bip322-js reach ECDSA through the `secp256k1`
// package, which in a browser build falls back to elliptic. elliptic's
// signing has a key exposure flaw with no fixed release
// (GHSA-848j-6mx2-7j84), so `secp256k1` and `elliptic` are replaced with
// small shims over @noble/secp256k1. Node's crypto module gets the same shim
// as build_sp.js. The build fails if either package still ends up bundled.

const path = require('path');
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

const shim = (name) => path.join(__dirname, 'src/www/js/lib', name);

const nobleOnly = {
  name: 'noble-only',
  setup(build) {
    build.onResolve({ filter: /^secp256k1$/ }, () => ({ path: shim('_secp256k1_shim.js') }));
    build.onResolve({ filter: /^elliptic$/ }, () => ({ path: shim('_elliptic_shim.js') }));
    build.onResolve({ filter: /^crypto$/ }, () => ({ path: shim('_crypto_shim.js') }));
  },
};

esbuild.build({
  entryPoints: ['src/www/js/lib/_message_entry.js'],
  bundle: true,
  format: 'iife',
  globalName: 'messageSigning',
  minify: true,
  target: 'es2020',
  outfile: 'src/www/js/lib/message.js',
  metafile: true,
  plugins: [
    nobleOnly,
    polyfillNode({
      globals: { buffer: true, process: true },
      polyfills: { crypto: false, stream: true, buffer: true, process: true, util: true, events: true, string_decoder: true, assert: true },
    }),
  ],
  define: {
    'global': 'globalThis',
  },
}).then((result) => {
  const leaked = Object.keys(result.metafile.inputs)
    .filter((input) => /node_modules\/(elliptic|secp256k1)\//.test(input));
  if (leaked.length) {
    throw new Error(`message.js must not bundle these: ${leaked.join(', ')}`);
  }
  console.log('message.js bundled');
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
