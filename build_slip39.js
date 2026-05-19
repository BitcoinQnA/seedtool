// Bundle src/www/js/lib/_slip39_entry.js → src/www/js/lib/slip39.js via esbuild
// with Node polyfills (slip39-ts uses crypto).
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

esbuild.build({
  entryPoints: ['src/www/js/lib/_slip39_entry.js'],
  bundle: true,
  format: 'iife',
  globalName: '__slip39Bundle',
  minify: true,
  target: 'es2020',
  outfile: 'src/www/js/lib/slip39.js',
  plugins: [
    polyfillNode({
      globals: { buffer: true, process: true },
      polyfills: { crypto: true, stream: true, buffer: true, process: true, util: true, events: true, string_decoder: true, assert: true },
    }),
  ],
  define: {
    'global': 'globalThis',
  },
}).then(() => {
  console.log('slip39.js bundled');
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
