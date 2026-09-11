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
  const ids = ['bip39PassTestCandidates', 'nostrNip06Nsec', 'nostrNip06PrivHex', 'nostrBip85Nsec', 'nostrBip85PrivHex', 'nostrNip06Npub'];
  for (const id of ids) document.getElementById(id).value = 'secret';
  run('wipeAllSeedMaterial')();
  tool.cancelPendingTimers();
  for (const id of ids) assert.strictEqual(document.getElementById(id).value, '', `${id} survived`);
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
