// Bundle PSBT inspector into js/lib/psbt.js
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

esbuild.build({
  entryPoints: ['src/www/js/lib/_psbt_entry.js'],
  bundle: true,
  format: 'iife',
  globalName: '__psbtBundle',
  minify: true,
  target: 'es2020',
  outfile: 'src/www/js/lib/psbt.js',
  plugins: [
    polyfillNode({
      globals: { buffer: true, process: true },
      polyfills: { crypto: true, buffer: true, process: true, util: true, stream: true, events: true, string_decoder: true, assert: true },
    }),
  ],
  define: { 'global': 'globalThis' },
}).then(() => console.log('psbt.js bundled'))
  .catch((e) => { console.error(e); process.exit(1); });
