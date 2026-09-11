/*
 * Tests for the Seed Tool UI logic in dom.js: word boxes checked as they are
 * typed, the Load Seed errors, Taproot in the passphrase tester, searching a
 * list of passphrases, output descriptors in Derived Addresses, and Clear
 * seed wiping the new fields.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadTool } = require('./harness');

const WWW = path.join(__dirname, '..', 'src', 'www');
const ZERO_12 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const ZERO_24 = `${'abandon '.repeat(23)}art`;
const BIP85_MASTER = 'xprv9s21ZrQH143K2LBWUUQRFXhucrQqBpKdRRxNVq2zBqsx8HVqFk2uYo8kmbaLLHRdqtQpUm98uKfu3vca1LqdGhUtyoFnCNkfmXRyPXLjbKb';

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

const openTool = async () => {
  const tool = loadTool();
  await vm.runInContext('setupDom', tool.context)();
  tool.cancelPendingTimers();
  vm.runInContext(fs.readFileSync(path.join(WWW, 'js', 'keys.js'), 'utf8'), tool.context);
  tool.run = (code) => vm.runInContext(code, tool.context);
  return tool;
};

// Word boxes as the page has them: a div per word holding an input
const fakeWordBoxes = (tool, words) => {
  const boxes = Array.from({ length: 24 }, (_, i) => {
    const input = tool.document.getElementById(`word-box-${i}`);
    input.value = words[i] || '';
    input.attributes = {};
    input.setAttribute = (name, value) => { input.attributes[name] = value; };
    input.classList.names.delete('hidden');
    return { querySelector: () => input, input };
  });
  tool.DOM.mnemonicInputs = boxes;
  return boxes.map((b) => b.input);
};

let failures = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('word boxes: a word prefix is fine while typing, not once the box is left', async () => {
  const tool = await openTool();
  const [input] = fakeWordBoxes(tool, ['aban']);
  const check = tool.run('checkMnemonicWordBox');
  assert.strictEqual(check(input), true);
  assert.strictEqual(input.attributes['aria-invalid'], 'false');
  assert.strictEqual(check(input, true), false);
  assert.ok(input.classList.contains('word-invalid'));
  input.value = 'Abandon';
  assert.strictEqual(check(input, true), true, 'capital letters are accepted');
  input.value = 'zzzq';
  assert.strictEqual(check(input), false, 'no word starts with zzzq');

  tool.DOM.mnemonicLengthSelect.value = '12';
  tool.run('showMnemonicWordHint')();
  const hint = tool.document.getElementById('inputMnemonicHint');
  assert.match(hint.textContent, /^Word 1: "zzzq" is not in the BIP39 English word list\. Did you mean "/);
  assert.ok(!hint.classList.contains('hidden'));
});

test('load seed: a bad word is marked and a bad checksum is explained', async () => {
  const tool = await openTool();
  tool.DOM.mnemonicLengthSelect.value = '12';
  const load = tool.run('mnemonicInputSeedLoad');
  const error = tool.document.getElementById('inputMnemonicError');

  const words = ZERO_12.split(' ');
  words[4] = 'abandonx';
  const inputs = fakeWordBoxes(tool, words);
  load();
  assert.match(error.textContent, /^abandonx \(at position 5\) is not in the BIP39 English word list/);
  assert.ok(inputs[4].classList.contains('word-invalid'));
  assert.ok(!inputs[3].classList.contains('word-invalid'));

  fakeWordBoxes(tool, `${'abandon '.repeat(11)}abandon`.split(' '));
  load();
  assert.match(error.textContent, /fail the BIP39 checksum/);
  assert.doesNotMatch(error.textContent, /^Error:/);
  tool.cancelPendingTimers();
});

test('passphrase tester: Taproot paths give Taproot addresses', async () => {
  const tool = await openTool();
  const address = tool.run(`getAddress(bip32.fromSeed(bip39.mnemonicToSeedSync('${ZERO_12}')).derivePath("m/86'/0'/0'/0/0"), 'bip86')`);
  assert.strictEqual(address, 'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr');
});

test('passphrase tester: finds the right passphrase in a list, at the right index', async () => {
  const tool = await openTool();
  const { DOM, document, run } = tool;
  DOM.bip39Phrase.value = ZERO_12;
  run(`bip32RootKey = bip32.fromSeed(bip39.mnemonicToSeedSync('${ZERO_12}'))`);
  const target = run(`bitcoin.payments.p2wpkh({ pubkey: bip32.fromSeed(bip39.mnemonicToSeedSync('${ZERO_12}', 'correct horse')).derivePath("m/84'/0'/0'/0/3").publicKey }).address`);
  document.getElementById('bip39KnownAddr').value = target;
  document.getElementById('bip39CustomPath').value = "m/84'/0'/0'/0";
  document.getElementById('bip39PassTestGap').value = '5';
  document.getElementById('bip39PassTestCandidates').value = 'wrong one\r\n\ncorrect horse\nnever tried';
  await run('bip39PassphraseTest')();
  tool.cancelPendingTimers();
  const message = document.getElementById('bip39PassTestInfo').innerHTML;
  assert.match(message, /MATCH/);
  assert.match(message, /passphrase 2 \(<code>correct horse<\/code>\) gives your address at index 3/);
  assert.ok(document.getElementById('bip39PassTestStop').hidden, 'Stop should be hidden again');

  document.getElementById('bip39PassTestGap').value = '3';
  await run('bip39PassphraseTest')();
  tool.cancelPendingTimers();
  assert.match(document.getElementById('bip39PassTestInfo').innerHTML, /None of the 3 passphrases gave your address in the first 3 addresses/);
});

test('descriptors: filled for standard accounts, cleared for custom paths', async () => {
  const tool = await openTool();
  const { DOM, document, run } = tool;
  const root = run(`bip32.fromSeed(bip39.mnemonicToSeedSync('${ZERO_12}')).toBase58()`);
  DOM.bip32RootKey.value = root;
  DOM.pathCoin.value = '0';
  DOM.pathAccount.value = '0';
  run("currentBip = 'bip84'");
  run('fillDescriptors')();
  const expected = run('seedKeys').singleSigDescriptors(root, { purpose: 84 });
  assert.strictEqual(document.getElementById('descriptorCombined').value, expected.combined);
  assert.strictEqual(document.getElementById('descriptorReceive').value, expected.receive);
  assert.strictEqual(document.getElementById('descriptorChange').value, expected.change);
  assert.ok(!document.getElementById('descriptorSection').classList.contains('hidden'));

  run("currentBip = 'bip32'");
  run('fillDescriptors')();
  assert.strictEqual(document.getElementById('descriptorCombined').value, '');
  assert.ok(document.getElementById('descriptorSection').classList.contains('hidden'));
});

test('clear seed: wipes the passphrase list and the Nostr keys', async () => {
  const tool = await openTool();
  const { document, run } = tool;
  const ids = ['bip39PassTestCandidates', 'nostrNip06Nsec', 'nostrNip06PrivHex', 'nostrBip85Nsec', 'nostrBip85PrivHex', 'nostrNip06Npub', 'xorResult'];
  for (const id of ids) document.getElementById(id).value = 'secret';
  run('wipeAllSeedMaterial')();
  tool.cancelPendingTimers();
  for (const id of ids) assert.strictEqual(document.getElementById(id).value, '', `${id} survived`);
});

// Stand-in rows holding one textarea each, as the Seed XOR boxes are
const fakeRows = (tool, prefix, count) =>
  Array.from({ length: count }, (_, i) => {
    const textarea = tool.document.getElementById(`${prefix}${i + 1}`);
    const row = tool.document.createElement('div');
    row.classList.names.delete('hidden');
    row.querySelector = () => textarea;
    return row;
  });

const loadBackupSheet = (tool) => {
  vm.runInContext(fs.readFileSync(path.join(WWW, 'js', 'backup-sheet.js'), 'utf8'), tool.context);
  return tool.run('backupSheet');
};

const makeQr = (tool) =>
  tool.run(`(data, mode) => { const qr = new QRCode(0, 'L'); qr.addData(data, mode); qr.make(); return qr; }`);

test('entropy: a pattern check, never a crack time', async () => {
  const tool = await openTool();
  const check = tool.run('entropyPatternCheck');
  assert.match(check('1'.repeat(60)), /^Warning: /);
  const rolls = Array.from(require('crypto').randomBytes(60), (b) => (b % 6) + 1).join('');
  const result = check(rolls);
  assert.ok(result === 'No obvious patterns' || result.startsWith('Warning: '), result);
  assert.doesNotMatch(result, /centuries|years|months|days|hours|minutes|seconds/);
  const html = fs.readFileSync(path.join(WWW, 'dev.html'), 'utf8');
  assert.doesNotMatch(html, /Time to crack|No passphrase entered/);
});

test('passphrase: no estimate until one is typed', async () => {
  const tool = await openTool();
  const text = tool.DOM.bip39PassphraseCrackTime;
  const box = tool.document.createElement('div');
  text.parentElement = box;
  const show = tool.run('showPassphraseStrength');
  show('');
  assert.strictEqual(text.textContent, '');
  assert.ok(box.classList.contains('hidden'));
  show('password1');
  assert.match(text.textContent, /^Time to crack with a fast offline attack: /);
  assert.ok(!box.classList.contains('hidden'));
  assert.ok(box.classList.contains('warning'));
  show('correct horse battery staple orbit lantern velvet quartz');
  assert.match(text.textContent, /centuries$/);
  assert.ok(box.classList.contains('recover-hint'));
  assert.ok(!box.classList.contains('warning'));
  show('');
  assert.ok(box.classList.contains('hidden'));
});

test('seed xor split: the shares combine back to the seed and stay put', async () => {
  const tool = await openTool();
  const { DOM, document, run } = tool;
  const rows = fakeRows(tool, 'xorShare', 8);
  const shareValues = (n) => rows.slice(0, n).map((row) => row.querySelector().value);
  document.querySelectorAll = (selector) => (selector === '.xor-share' ? rows : []);
  document.getElementById('xorShareCount').value = '3';
  DOM.bip39Phrase.value = ZERO_24;
  const make = run('makeXorShares');
  make();
  const shares = shareValues(3);
  for (const share of shares) {
    assert.strictEqual(share.split(' ').length, 24);
    assert.ok(run('bip39').validateMnemonic(share));
  }
  assert.ok(!rows[2].classList.contains('hidden'));
  assert.ok(rows.slice(3).every((row) => row.classList.contains('hidden') && row.querySelector().value === ''));
  assert.strictEqual(run('xorMnemonics')(shares).phrase, ZERO_24);
  assert.match(document.getElementById('xorSplitCheck').textContent, /^Checked: these 3 shares combine back/);

  make();
  assert.deepStrictEqual(shareValues(3), shares, 'the shares changed without being asked to');
  make(true);
  assert.notDeepStrictEqual(shareValues(3), shares);

  DOM.bip39Phrase.value = 'not a seed';
  make();
  assert.ok(rows.every((row) => row.querySelector().value === ''), 'shares of an invalid seed were shown');
  tool.cancelPendingTimers();
});

test('bip85 passwords: base85 and base64 from the page, and a bad length explained', async () => {
  const tool = await openTool();
  const { DOM, document, run } = tool;
  DOM.bip32RootKey.value = BIP85_MASTER;
  const format = document.getElementById('bip85PWDFormat');
  const error = document.getElementById('bip85PWDError');
  format.value = 'base85';
  DOM.bip85PWDLength.value = '12';
  DOM.bip85PWDIndex.value = '0';
  await run('calcBip85Password')();
  assert.strictEqual(DOM.bip85PWDPassword.value, '_s`{TW89)i4`');
  assert.ok(error.classList.contains('hidden'));

  DOM.bip85PWDLength.value = '90';
  await run('calcBip85Password')();
  assert.strictEqual(DOM.bip85PWDPassword.value, '');
  assert.match(error.textContent, /base85 password is 10 to 80 characters/);
  assert.ok(!error.classList.contains('hidden'));

  // Switching to base64 moves a length it cannot use into its range
  format.value = 'base64';
  DOM.bip85PWDLength.value = '12';
  run('bip85PasswordFormatChanged')();
  assert.strictEqual(Number(DOM.bip85PWDLength.value), 20);
  assert.strictEqual(DOM.bip85PWDPassword.value.length, 20);
  tool.cancelPendingTimers();
});

test('bip85 dice: the spec vector, and the limits', async () => {
  const tool = await openTool();
  const { DOM, document, run } = tool;
  DOM.bip32RootKey.value = BIP85_MASTER;
  const set = (id, value) => { document.getElementById(id).value = value; };
  const out = document.getElementById('bip85DiceResult');
  const error = document.getElementById('bip85DiceError');
  set('bip85DiceSides', '6');
  set('bip85DiceCount', '10');
  set('bip85DiceIndex', '0');
  run('calcBip85Dice')();
  assert.strictEqual(out.value, '1, 0, 0, 2, 0, 1, 5, 5, 2, 4');
  assert.ok(error.classList.contains('hidden'));

  set('bip85DiceCount', '1001');
  run('calcBip85Dice')();
  assert.strictEqual(out.value, '');
  assert.match(error.textContent, /1,000/);

  set('bip85DiceCount', '10');
  set('bip85DiceSides', '1');
  run('calcBip85Dice')();
  assert.match(error.textContent, /Sides must be a whole number from 2/);
  tool.cancelPendingTimers();
});

test('eye button: shows it is pressed and hides words outside the private fields', async () => {
  const tool = await openTool();
  const attrs = {};
  tool.DOM.showHide.setAttribute = (name, value) => { attrs[name] = value; };
  const toggle = tool.run('toggleHideAllPrivateData');
  toggle();
  assert.strictEqual(attrs['aria-pressed'], 'true');
  assert.ok(tool.document.body.classList.contains('is-private'));
  toggle();
  assert.strictEqual(attrs['aria-pressed'], 'false');
  assert.ok(!tool.document.body.classList.contains('is-private'));
  tool.cancelPendingTimers();
});

test('backup sheet: the pre-drawn squares match real SeedQRs', async () => {
  const tool = await openTool();
  const sheet = loadBackupSheet(tool);
  const keys = tool.run('seedKeys');
  const make = makeQr(tool);
  const compact = tool.run('phraseToCompactQrBytes');
  for (let n = 0; n < 4; n++) {
    for (const words of [12, 24]) {
      const mnemonic = tool.run('bip39').generateMnemonic(words === 12 ? 128 : 256);
      const codes = [
        ['compact', make(compact(mnemonic), 'Byte')],
        ['standard', make(keys.mnemonicToSeedQrDigits(mnemonic), 'Numeric')],
      ];
      for (const [format, qr] of codes) {
        const size = qr.getModuleCount();
        assert.strictEqual(size, sheet.SIZES[words][format], `${words}-word ${format} grid size`);
        for (const [cell, dark] of sheet.fixedModules(size)) {
          const [r, c] = cell.split(',').map(Number);
          assert.strictEqual(qr.isDark(r, c), dark, `${words}-word ${format}: square ${cell}`);
        }
      }
    }
  }
});

test('backup sheet: blank unless the words are asked for', async () => {
  const tool = await openTool();
  const sheet = loadBackupSheet(tool);
  const keys = tool.run('seedKeys');
  const blank = sheet.build({ words: 12, format: 'standard' });
  assert.strictEqual(blank.match(/<li>/g).length, 12);
  assert.doesNotMatch(blank, /abandon/);
  assert.match(blank, /SeedQR, 25 by 25 squares/);
  const fixedDark = [...sheet.fixedModules(25).values()].filter(Boolean).length;
  assert.strictEqual(blank.match(/<rect /g).length, fixedDark);
  const blank24 = sheet.build({ words: 24, format: 'compact' });
  assert.strictEqual(blank24.match(/<li>/g).length, 24);
  assert.match(blank24, /Compact SeedQR, 25 by 25 squares/);

  const filled = sheet.build({ mnemonic: ZERO_12, format: 'standard' });
  assert.strictEqual(filled.match(/>abandon</g).length, 11);
  assert.match(filled, />about</);
  assert.match(filled, />73c5da0a</);
  const qr = makeQr(tool)(keys.mnemonicToSeedQrDigits(ZERO_12), 'Numeric');
  let dark = 0;
  for (let r = 0; r < 25; r++) for (let c = 0; c < 25; c++) if (qr.isDark(r, c)) dark += 1;
  assert.strictEqual(filled.match(/<rect /g).length, dark);
  assert.throws(() => sheet.build({ mnemonic: 'abandon abandon' }), /not a valid BIP39 mnemonic/);
});

test('seedqr: one button, and the QR window offers both formats', async () => {
  const tool = await openTool();
  const seedQrData = tool.run('seedQrData');
  const keys = tool.run('seedKeys');
  const standard = seedQrData(ZERO_12, 'standard');
  assert.strictEqual(standard.mode, 'Numeric');
  assert.strictEqual(standard.data, keys.mnemonicToSeedQrDigits(ZERO_12));
  const compact = seedQrData(ZERO_12, 'compact');
  assert.strictEqual(compact.mode, 'Byte');
  assert.strictEqual(compact.data, tool.run('phraseToCompactQrBytes')(ZERO_12));
  const html = fs.readFileSync(path.join(WWW, 'dev.html'), 'utf8');
  assert.doesNotMatch(html, /standardSeedQR/);
  assert.strictEqual((html.match(/class="seedqr-format__btn" data-format="(standard|compact)"/g) || []).length, 2);
});

test('layout: the shell can re-measure text boxes once a view is shown', async () => {
  const tool = await openTool();
  // refreshTextareaSizes in shell.js calls window.adjustPanelHeight
  assert.strictEqual(typeof tool.run('window.adjustPanelHeight'), 'function');
});

(async () => {
  console.log('seed tool ui');
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  ok  ${name}`);
    } catch (err) {
      failures += 1;
      console.error(`  FAIL ${name}`);
      console.error(`       ${err.message}`);
    }
  }
  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log('\nall tests passed');
})();
