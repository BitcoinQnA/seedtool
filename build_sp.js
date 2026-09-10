// Bundle src/www/js/lib/_sp_entry.js → src/www/js/lib/sp.js using esbuild +
// node-polyfill. Run via `node build_sp.js`.
//
// Two things are kept out of the bundle on purpose:
// - Node's crypto module. The bundled code only calls createHash('sha256'),
//   createHmac('sha256') and randomBytes, so it gets a small shim
//   (_crypto_shim.js) instead of the ~2 MB polyfill with RSA, Diffie-Hellman
//   and AES that nothing here uses.
// - bip39 wordlists other than English. Only mnemonicToSeedSync is called,
//   which needs no wordlist, and bip39 skips any list that fails to load.

const path = require('path');
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

const trimForBrowser = {
  name: 'trim-for-browser',
  setup(build) {
    build.onResolve({ filter: /^crypto$/ }, () => ({
      path: path.join(__dirname, 'src/www/js/lib/_crypto_shim.js'),
    }));
    build.onResolve({ filter: /\/wordlists\/[a-z_]+\.json$/ }, (args) =>
      /\/english\.json$/.test(args.path)
        ? undefined
        : { path: args.path, namespace: 'unbundled-wordlist' }
    );
    build.onLoad({ filter: /.*/, namespace: 'unbundled-wordlist' }, () => ({
      contents: "throw new Error('wordlist not bundled');",
      loader: 'js',
    }));
  },
};

esbuild.build({
  entryPoints: ['src/www/js/lib/_sp_entry.js'],
  bundle: true,
  format: 'iife',
  globalName: '__silentPaymentsBundle',
  minify: true,
  target: 'es2020',
  outfile: 'src/www/js/lib/sp.js',
  plugins: [
    trimForBrowser,
    polyfillNode({
      globals: { buffer: true, process: true },
      polyfills: { crypto: false, stream: true, buffer: true, process: true, util: true, events: true, string_decoder: true, assert: true },
    }),
  ],
  define: {
    'global': 'globalThis',
  },
}).then(() => {
  console.log('sp.js bundled');
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
