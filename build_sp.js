// Bundle src/www/js/lib/_sp_entry.js → src/www/js/lib/sp.js using esbuild +
// node-polyfill. Run via `node build_sp.js`.

const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

esbuild.build({
  entryPoints: ['src/www/js/lib/_sp_entry.js'],
  bundle: true,
  format: 'iife',
  globalName: '__silentPaymentsBundle',
  minify: true,
  target: 'es2020',
  outfile: 'src/www/js/lib/sp.js',
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
  console.log('sp.js bundled');
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
