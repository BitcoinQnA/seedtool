/*
 * Printable seed backup sheet. By default it is a blank worksheet: numbered
 * boxes for the words and an empty SeedQR grid to fill in by hand, with the
 * parts that are the same on every SeedQR of that size already drawn.
 * Printing the words and SeedQR themselves is opt-in, because printers can
 * keep a copy of what they print.
 *
 * The sheet is built when asked for, printed, and removed from the page
 * again. Exposed as window.backupSheet.
 */
(function () {
  'use strict';

  // SeedQR grid sizes by word count, as on SeedSigner's templates
  const SIZES = {
    12: { standard: 25, compact: 21 },
    24: { standard: 29, compact: 25 },
  };

  const escapeHtml = (text) =>
    String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // The squares that are the same on every QR code of this size: the three
  // corner finder squares with their light borders, the timing lines that
  // join them, the alignment square (sizes 25 and up) and the dark square
  // beside the bottom-left finder. Returns a Map of "row,col" to true for
  // dark and false for light.
  const fixedModules = (size) => {
    const cells = new Map();
    const set = (row, col, dark) => {
      if (row >= 0 && col >= 0 && row < size && col < size) cells.set(`${row},${col}`, dark);
    };
    const finder = (top, left) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
          set(top + r, left + c, ring !== 2 && ring !== 4);
        }
      }
    };
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);
    for (let i = 8; i < size - 8; i++) {
      set(6, i, i % 2 === 0);
      set(i, 6, i % 2 === 0);
    }
    if (size >= 25) {
      const centre = size - 7;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          set(centre + r, centre + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
        }
      }
    }
    set(size - 8, 8, true);
    return cells;
  };

  // A size x size grid with numbered edges. `isDark(row, col)` says which
  // squares are filled in. Every fifth line is heavier to help counting.
  const gridSvg = (size, isDark, label) => {
    const cell = 10;
    const margin = 12;
    const end = margin + size * cell;
    const squares = [];
    const lines = [];
    const numbers = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (isDark(r, c)) squares.push(`<rect x="${margin + c * cell}" y="${margin + r * cell}" width="${cell}" height="${cell}"/>`);
      }
    }
    for (let i = 0; i <= size; i++) {
      const at = margin + i * cell;
      const width = i % 5 === 0 || i === size ? 0.9 : 0.35;
      lines.push(`<line x1="${margin}" y1="${at}" x2="${end}" y2="${at}" stroke-width="${width}"/>`);
      lines.push(`<line x1="${at}" y1="${margin}" x2="${at}" y2="${end}" stroke-width="${width}"/>`);
    }
    for (let i = 0; i < size; i++) {
      const mid = margin + i * cell + cell / 2;
      numbers.push(`<text x="${mid}" y="${margin - 3}">${i + 1}</text>`);
      numbers.push(`<text x="${margin - 6}" y="${mid + 2}">${i + 1}</text>`);
    }
    return `<svg class="backup-sheet__grid" viewBox="0 0 ${end + 2} ${end + 2}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(label)}">`
      + `<g fill="#000">${squares.join('')}</g>`
      + `<g stroke="#666">${lines.join('')}</g>`
      + `<g fill="#444" font-size="5" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">${numbers.join('')}</g>`
      + '</svg>';
  };

  const makeSeedQr = (mnemonic, format) => {
    const qr = new QRCode(0, 'L');
    if (format === 'compact') qr.addData(phraseToCompactQrBytes(mnemonic));
    else qr.addData(seedKeys.mnemonicToSeedQrDigits(mnemonic), 'Numeric');
    qr.make();
    return qr;
  };

  // The sheet's HTML. With no mnemonic it is a blank worksheet for `words`
  // words; with one, the words, fingerprint and SeedQR are filled in.
  const build = ({ words = 24, format = 'standard', mnemonic = '' } = {}) => {
    const kind = format === 'compact' ? 'compact' : 'standard';
    const qrName = kind === 'compact' ? 'Compact SeedQR' : 'SeedQR';
    const phrase = mnemonic.trim().split(/\s+/).filter(Boolean).join(' ');
    const filled = phrase.length > 0;
    if (filled && !bip39.validateMnemonic(phrase)) {
      throw new Error('The loaded seed is not a valid BIP39 mnemonic.');
    }
    const list = filled ? phrase.split(' ') : [];
    const count = filled ? list.length : SIZES[words] ? Number(words) : 24;
    const qr = filled ? makeSeedQr(phrase, kind) : null;
    const size = qr ? qr.getModuleCount() : SIZES[count][kind];
    const fixed = fixedModules(size);
    const isDark = qr ? (r, c) => qr.isDark(r, c) : (r, c) => fixed.get(`${r},${c}`) === true;
    const fingerprint = filled
      ? bip32.fromSeed(bip39.mnemonicToSeedSync(phrase)).fingerprint.toString('hex')
      : '';
    const boxes = Array.from({ length: count }, (_, i) =>
      `<li><span class="backup-sheet__num">${i + 1}</span><span class="backup-sheet__word">${escapeHtml(list[i] || '')}</span></li>`
    ).join('');
    const qrHelp = filled
      ? `This is the ${qrName} for the words on the first page. Anyone who scans it has your seed, so keep it as safe as the words.`
      : `The corner squares and the other parts that are the same on every ${qrName} of this size are printed for you. Copy the rest from the ${qrName} in the Seed Tool one square at a time, using the numbers along the edges.`;
    return `
<section class="backup-sheet__page">
  <h1 class="backup-sheet__title">Bitcoin seed backup</h1>
  <div class="backup-sheet__fields">
    <div><span>Wallet</span><span class="backup-sheet__line"></span></div>
    <div><span>Date</span><span class="backup-sheet__line"></span></div>
    <div><span>Fingerprint</span><span class="backup-sheet__line">${escapeHtml(fingerprint)}</span></div>
  </div>
  <h2>Seed words</h2>
  <ol class="backup-sheet__words" style="grid-template-rows: repeat(${Math.ceil(count / 3)}, auto)">${boxes}</ol>
  <h2>Notes</h2>
  <div class="backup-sheet__notes"></div>
  <p class="backup-sheet__foot">Never write your passphrase on this sheet. Keep it somewhere safe and private.${filled ? ' The fingerprint is for the words alone, without a passphrase.' : ''}</p>
</section>
<section class="backup-sheet__page">
  <h1 class="backup-sheet__title">${qrName}, ${size} by ${size} squares</h1>
  <p>${qrHelp}</p>
  ${gridSvg(size, isDark, `${qrName} grid, ${size} by ${size}`)}
  <p class="backup-sheet__foot">Signers such as SeedSigner can scan a hand-drawn ${qrName}. Scan it once to check it gives the right fingerprint before you rely on it.</p>
</section>`;
  };

  const remove = () => {
    const sheet = document.getElementById('backupSheet');
    if (sheet) sheet.remove();
    document.body.classList.remove('is-printing-sheet');
  };

  // Add the sheet, print it, and take it off the page once printing is done
  const print = (options) => {
    remove();
    const sheet = document.createElement('div');
    sheet.id = 'backupSheet';
    sheet.className = 'backup-sheet';
    sheet.innerHTML = build(options);
    document.body.appendChild(sheet);
    document.body.classList.add('is-printing-sheet');
    window.addEventListener('afterprint', remove, { once: true });
    window.print();
  };

  window.backupSheet = { SIZES, fixedModules, build, print, remove };
})();
