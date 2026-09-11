// Bundle src/www/js/lib/_qrscan_entry.js → src/www/js/lib/qrscan.js using
// esbuild + node-polyfill. Run via `node build_qrscan.js`.
//
// jsQR decodes QR codes; @ngraveio/bc-ur reassembles animated UR codes. Node's
// crypto module gets the same small shim as build_sp.js, and the build fails
// if the full crypto polyfill ends up bundled.

const path = require('path');
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

const cryptoShim = {
  name: 'crypto-shim',
  setup(build) {
    build.onResolve({ filter: /^crypto$/ }, () => ({
      path: path.join(__dirname, 'src/www/js/lib/_crypto_shim.js'),
    }));
  },
};

esbuild.build({
  entryPoints: ['src/www/js/lib/_qrscan_entry.js'],
  bundle: true,
  format: 'iife',
  globalName: 'qrScan',
  minify: true,
  target: 'es2020',
  outfile: 'src/www/js/lib/qrscan.js',
  metafile: true,
  plugins: [
    cryptoShim,
    polyfillNode({
      globals: { buffer: true, process: true },
      polyfills: { crypto: false, buffer: true, process: true, util: true, stream: true, events: true, string_decoder: true, assert: true },
    }),
  ],
  define: {
    'global': 'globalThis',
  },
}).then((result) => {
  const leaked = Object.keys(result.metafile.inputs)
    .filter((input) => /crypto-browserify|node_modules\/elliptic\//.test(input));
  if (leaked.length) throw new Error(`qrscan.js must not bundle these: ${leaked.join(', ')}`);
  console.log('qrscan.js bundled');
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
