// Bundle the combined SLIP-39 + SSKR entry via esbuild + Node polyfills.
const esbuild = require('esbuild');
const { polyfillNode } = require('esbuild-plugin-polyfill-node');

esbuild.build({
  entryPoints: ['src/www/js/lib/_shamir_entry.js'],
  bundle: true,
  format: 'iife',
  globalName: '__shamirBundle',
  minify: true,
  target: 'es2020',
  outfile: 'src/www/js/lib/shamir.js',
  plugins: [
    polyfillNode({
      globals: { buffer: true, process: true },
      polyfills: { crypto: true, stream: true, buffer: true, process: true, util: true, events: true, string_decoder: true, assert: true },
    }),
  ],
  define: { 'global': 'globalThis' },
}).then(() => {
  console.log('shamir.js bundled');
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
