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
    const regex1 = new RegExp(/<script src="(?<path>...*)">[^]*?</);
    let array1 = regex1.exec(result);
    while (array1 !== null) {
      const scriptLocation = path.join(__dirname, `/src/www/`, `${array1[1]}`);
      console.log(`Adding script from ${scriptLocation}`);
      const js = await readFile(scriptLocation, 'utf8');
      result = result.replace(
        array1[0],
        `<script>
      ${js}
      <`
      );
      array1 = regex1.exec(result);
      console.log('Done!');
    }
    const regex2 = /<link rel="stylesheet" href="(?<path>...*)?">/;
    let array2 = regex2.exec(result);
    while (array2 !== null) {
      const scriptLocation = path.join(__dirname, `/src/www/`, `${array2[1]}`);
      console.log(`Adding Stylesheet from ${scriptLocation}`);
      const css = await readFile(scriptLocation, 'utf8');
      result = result.replace(
        array2[0],
        `<style>
      ${css}
      </style>`
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
