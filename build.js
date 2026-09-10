const fs = require('fs');
const util = require('util');
const path = require('path');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
console.time('Build script took');
console.log('Building HTML file...');
(async () => {
  try {
    let result = await readFile(
      path.join(__dirname, '/src/www/dev.html'),
      'utf8'
    );
    result = result.replace(/<script id="websocket">[^]*<\/script>/, '');
    console.log('Hot reload Web Socket script tags removed...');
    // Content Security Policy for the built page. Scripts and styles are
    // all inline, so inline is allowed. Nothing else may load, and the only
    // requests allowed are the two opt-in online features: PayNym avatars
    // (images) and BIP-353 DNS-over-HTTPS lookups. dev.html has no policy,
    // so the dev server's hot reload keeps working.
    const csp = [
      "default-src 'none'",
      "script-src 'unsafe-inline'",
      "style-src 'unsafe-inline'",
      'img-src data: blob: https://paynym.rs',
      'connect-src https://cloudflare-dns.com https://dns.google',
      "base-uri 'none'",
      "form-action 'none'",
      "object-src 'none'",
    ].join('; ');
    const charset = '<meta charset="utf-8" />';
    if (!result.includes(charset)) throw new Error('No charset meta to put the CSP after');
    result = result.replace(
      charset,
      () => `${charset}\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`
    );
    console.log('Content Security Policy added...');
    const regex1 = new RegExp(
      /<script class="dev-script" src="(?<path>[^"]+)"><\/script>/
    );
    let array1 = regex1.exec(result);
    while (array1 !== null) {
      const scriptLocation = path.join(__dirname, `/src/www/`, `${array1[1]}`);
      console.log(`Adding script from ${scriptLocation}`);
      const js = await readFile(scriptLocation, 'utf8');
      result = result.replace(
        array1[0],
        () =>
          `<script>\n${js}\n</script>`
      );
      console.log(`${array1[1]} added!`);
      array1 = regex1.exec(result);
      console.log('Done!');
    }
    const regex2 = /<link rel="stylesheet" href="(?<path>[^"]+)">/;
    let array2 = regex2.exec(result);
    while (array2 !== null) {
      const scriptLocation = path.join(__dirname, `/src/www/`, `${array2[1]}`);
      console.log(`Adding Stylesheet from ${scriptLocation}`);
      const css = await readFile(scriptLocation, 'utf8');
      result = result.replace(
        array2[0],
        () => `<style>\n${css}\n</style>`
      );
      array2 = regex2.exec(result);
      console.log('Done!');
    }

    const output = path.join(__dirname, '/dist/index.html');
    await writeFile(output, result, 'utf8');
    console.log(`Task completed! Built file is available at ${output}`);
  } catch (error) {
    console.log('Build failed', error);
  }
  console.timeEnd('Build script took');
})();
