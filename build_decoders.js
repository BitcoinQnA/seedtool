// Bundle BIP-329 + BOLT-11 + BOLT-12 decoders into js/lib/decoders.js
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

esbuild.build({
  entryPoints: ['src/www/js/lib/_decoders_entry.js'],
  bundle: true,
  format: 'iife',
  globalName: '__decodersBundle',
  minify: true,
  target: 'es2020',
  outfile: 'src/www/js/lib/decoders.js',
  plugins: [
    polyfillNode({
      globals: { buffer: true, process: true },
      polyfills: { crypto: true, buffer: true, process: true, util: true, stream: true, events: true, string_decoder: true, assert: true },
    }),
  ],
  define: { 'global': 'globalThis' },
}).then(() => console.log('decoders.js bundled'))
  .catch((e) => { console.error(e); process.exit(1); });
