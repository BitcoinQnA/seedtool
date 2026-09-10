/*
 * Regression tests for tools that must never show a wrong seed as if it were
 * right: Seed XOR, the One Time Pad, and clearing the loaded seed.
 *
 * Each used to accept bad input (a word not in the list, a share of another
 * length, a damaged key) and still print a checksummed, valid looking
 * mnemonic, or leave key material on the page after "Clear seed".
 */

const assert = require('assert');
const vm = require('vm');
const { loadTool } = require('./harness');

// dom.js runs debounced work on a timer that the stand-in cannot satisfy.
// Those failures are background noise, not the behaviour under test.
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

// BIP39 reference vectors for entropy 00.., 7f.., 80.. and ff..
const ZERO_12 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const SEVENF_12 = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const EIGHTY_12 = 'letter advice cage absurd amount doctor acoustic avoid letter advice cage above';
const FF_12 = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
const ZERO_24 = `${'abandon '.repeat(23)}art`;

// COLDCARD firmware testing/test_seed_xor.py: parts, then expected result
const COLDCARD_VECTORS = [
  [
    'become wool crumble brand camera cement gloom sell stand once connect stage',
    'save saddle indicate embrace detail weasel spread life staff mushroom bicycle light',
    'unlock damp injury tape enhance pause sheriff onion valley panic finger moon',
    'drama jeans craft mixture filter lamp invest suggest vacant neutral history swim',
  ],
  [
    'example twelve meadow embrace neither sign ribbon equal inspire guess episode piece fatal unlock prefer unhappy vanish curtain',
    'ostrich present hold dwarf area say act carpet eight jeans student warfare access cause offer suit dawn height',
    'sure lawsuit half gym fatal column remain dash cage orchard frame reform robust social inspire online evolve lobster',
    'ancient dish minute goddess smooth foil auction floor bean mimic scale transfer trumpet alter echo push mass task',
  ],
  [
    'romance wink lottery autumn shop bring dawn tongue range crater truth ability miss spice fitness easy legal release recall obey exchange recycle dragon room',
    'lion misery divide hurry latin fluid camp advance illegal lab pyramid unaware eager fringe sick camera series noodle toy crowd jeans select depth lounge',
    'vault nominee cradle silk own frown throw leg cactus recall talent worry gadget surface shy planet purpose coffee drip few seven term squeeze educate',
    'silent toe meat possible chair blossom wait occur this worth option bag nurse find fish scene bench asthma bike wage world quit primary indoor',
  ],
];

const openTool = async () => {
  const tool = loadTool();
  await vm.runInContext('setupDom', tool.context)();
  tool.cancelPendingTimers();
  tool.run = (code) => vm.runInContext(code, tool.context);
  return tool;
};

let failures = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('xor: matches the COLDCARD test vectors', async () => {
  const { run } = await openTool();
  const xor = run('xorMnemonics');
  for (const [a, b, c, expected] of COLDCARD_VECTORS) {
    const result = xor([a, b, c]);
    assert.strictEqual(result.error, undefined, result.error);
    assert.strictEqual(result.phrase, expected);
  }
});

test('xor: the result is the XOR of the entropy', async () => {
  const { run } = await openTool();
  const xor = run('xorMnemonics');
  assert.strictEqual(xor([SEVENF_12, FF_12]).phrase, EIGHTY_12);
  assert.strictEqual(xor([SEVENF_12, ZERO_12]).phrase, SEVENF_12);
  assert.strictEqual(xor([SEVENF_12, FF_12, EIGHTY_12]).phrase, ZERO_12);
});

test('xor: splitting then combining returns the original seed', async () => {
  const { run } = await openTool();
  const xor = run('xorMnemonics');
  const generate = run('(bits) => window.bip39.generateMnemonic(bits)');
  for (const bits of [128, 160, 192, 224, 256]) {
    for (let i = 0; i < 10; i++) {
      const seed = generate(bits);
      const shareB = generate(bits);
      const shareC = generate(bits);
      const shareA = xor([seed, shareB, shareC]).phrase;
      assert.strictEqual(xor([shareA, shareB, shareC]).phrase, seed);
    }
  }
});

test('xor: a word not in the list is refused', async () => {
  const { run } = await openTool();
  const result = run('xorMnemonics')([ZERO_12, SEVENF_12.replace('winner', 'winnerx')]);
  assert.strictEqual(result.phrase, undefined);
  assert.match(result.error, /^Seed 2: /);
  assert.match(result.error, /winnerx/);
});

test('xor: a share with a bad checksum is refused', async () => {
  const { run } = await openTool();
  const result = run('xorMnemonics')([ZERO_12, `${'abandon '.repeat(11)}abandon`]);
  assert.strictEqual(result.phrase, undefined);
  assert.match(result.error, /Seed 2: fails the BIP39 checksum/);
});

test('xor: shares of different lengths are refused', async () => {
  const { run } = await openTool();
  const xor = run('xorMnemonics');
  const shorter = xor([ZERO_24, SEVENF_12]);
  assert.strictEqual(shorter.phrase, undefined);
  assert.match(shorter.error, /Seed 2 has 12 words but the loaded seed has 24/);
  const longer = xor([ZERO_12, ZERO_12, ZERO_24]);
  assert.strictEqual(longer.phrase, undefined);
  assert.match(longer.error, /Seed 3 has 24 words but the loaded seed has 12/);
});

test('xor: a blank share, a missing seed or no share is refused', async () => {
  const { run } = await openTool();
  const xor = run('xorMnemonics');
  assert.match(xor([ZERO_12, '   ']).error, /Seed 2: no words entered/);
  assert.match(xor(['', ZERO_12]).error, /The loaded seed: no words entered/);
  assert.ok(xor([ZERO_12]).error);
});

test('xor: an invalid share clears the previous result from the page', async () => {
  const tool = await openTool();
  const { DOM, document } = tool;
  const share = { value: FF_12 };
  const shareDiv = {
    classList: { contains: () => false },
    querySelector: () => share,
  };
  document.querySelectorAll = (selector) => (selector === '.xor-seed' ? [shareDiv] : []);
  DOM.bip39Phrase.value = SEVENF_12;
  const calculateXor = tool.run('calculateXor');
  const result = document.getElementById('xorResult');
  const errorEl = document.getElementById('xorError');

  calculateXor();
  assert.strictEqual(result.value, EIGHTY_12);
  assert.ok(errorEl.classList.contains('hidden'), 'an error showed for valid shares');

  share.value = FF_12.replace('wrong', 'wrongx');
  calculateXor();
  assert.strictEqual(result.value, '', 'the earlier result was left on screen');
  assert.ok(!errorEl.classList.contains('hidden'), 'no error was shown');
  assert.match(errorEl.textContent, /wrongx/);
  tool.cancelPendingTimers();
});

test('otp: encrypting then decrypting returns the phrase', async () => {
  const { run } = await openTool();
  const otp = run('otp');
  for (const phrase of [SEVENF_12, ZERO_24]) {
    const key = await otp.generate(phrase.split(' ').length);
    const cipher = await otp.encrypt(key, phrase);
    assert.notStrictEqual(cipher, phrase);
    assert.strictEqual(await otp.decrypt(key, cipher), phrase);
  }
});

test('otp: the example documented in dom.js still decrypts', async () => {
  const { run } = await openTool();
  const otp = run('otp');
  assert.strictEqual(
    await otp.decrypt(
      'AAwCnwGIAe0EWABWAI4AkAMjAFQBLgZjB1T1PJtz',
      'fault couple digital merge area bar barrel grab argue cheap soap typical'
    ),
    'abandon ability able about above absent absorb abstract absurd abuse access accident'
  );
});

test('otp: an encrypted word not in the list is refused', async () => {
  const { run } = await openTool();
  const otp = run('otp');
  const key = await otp.generate(12);
  const cipher = (await otp.encrypt(key, SEVENF_12)).split(' ');
  cipher[4] = 'notaword';
  await assert.rejects(otp.decrypt(key, cipher.join(' ')), /"notaword" \(word 5\)/);
  await assert.rejects(otp.encrypt(key, SEVENF_12.replace('thank', 'thanks')), /"thanks" \(word 3\)/);
});

test('otp: a damaged key is refused, not used', async () => {
  const { run } = await openTool();
  const otp = run('otp');
  const key = await otp.generate(12);
  const damaged = key.slice(0, 5) + (key[5] === 'A' ? 'B' : 'A') + key.slice(6);
  await assert.rejects(otp.encrypt(damaged, SEVENF_12), /checksum/);
  await assert.rejects(otp.decrypt(damaged, SEVENF_12), /checksum/);
  await assert.rejects(otp.decrypt('not a key!', SEVENF_12), /not valid|checksum/);
});

test('otp: a key for another length is refused', async () => {
  const { run } = await openTool();
  const otp = run('otp');
  const key24 = await otp.generate(24);
  await assert.rejects(otp.encrypt(key24, SEVENF_12), /key is for 24 words but there are 12/);
});

test('otp: validateKey reports a bad key instead of throwing', async () => {
  const { run } = await openTool();
  const otp = run('otp');
  const key = await otp.generate(12);
  assert.strictEqual(await otp.validateKey(key, 12), true);
  assert.strictEqual(await otp.validateKey(key, 24), false);
  assert.strictEqual(await otp.validateKey('!!!', 12), false);
});

test('reset: values derived from the old seed do not survive a seed change', async () => {
  const tool = await openTool();
  const derived = ['bip32AccountXprv', 'bip32AccountXpub', 'bip85PWDPassword', 'myZpub', 'myYpub', 'xorResult'];
  for (const id of derived) tool.document.getElementById(id).value = 'from the old seed';
  tool.run('resetEverything')();
  tool.cancelPendingTimers();
  for (const id of derived) {
    assert.strictEqual(tool.document.getElementById(id).value, '', `${id} survived`);
  }
});

test('clear seed: wipes tool input and the BIP85 parent chain', async () => {
  const tool = await openTool();
  const { DOM, document } = tool;
  DOM.bip39Phrase.value = SEVENF_12;
  DOM.bip39Passphrase.value = 'secret passphrase';
  DOM.entropyInput.value = '1'.repeat(128);
  document.getElementById('otpDecrypted').value = SEVENF_12;
  document.getElementById('singleSigInput').value = 'secret private key';
  tool.run('bip85Lineage.push({ phrase: "parent seed", passphrase: "" })');
  DOM.bip85LoadParent.disabled = false;

  tool.run('wipeAllSeedMaterial')();
  tool.cancelPendingTimers();

  assert.strictEqual(DOM.bip39Phrase.value, '');
  assert.strictEqual(DOM.bip39Passphrase.value, '');
  assert.strictEqual(DOM.entropyInput.value, '');
  assert.strictEqual(document.getElementById('otpDecrypted').value, '');
  assert.strictEqual(document.getElementById('singleSigInput').value, '');
  assert.strictEqual(tool.run('bip85Lineage.length'), 0, 'the parent seed is still held');
  assert.ok(DOM.bip85LoadParent.disabled);
});

test('paynym: nothing is sent to paynym.rs until the button is pressed', async () => {
  const tool = await openTool();
  const { DOM, document, context } = tool;
  const images = [];
  const createElement = document.createElement;
  document.createElement = (tag) => {
    const el = createElement(tag);
    if (tag === 'img') images.push(el);
    return el;
  };
  context.navigator.onLine = true;
  tool.run(
    "DOM.bip47PaynymSections = [document.getElementById('bip47MyRobotSection'), document.getElementById('bip47CPRobotSection')]"
  );
  DOM.bip47UsePaynym.checked = true;
  DOM.bip39Phrase.value = SEVENF_12;
  tool.run('bip32RootKey = bip32.fromSeed(bip39.mnemonicToSeedSync(getPhrase()))');
  tool.run('calcBip47')();
  tool.run('clearBip47Addresses')();
  tool.run('togglePaynym')();
  assert.strictEqual(images.length, 0, 'an avatar was requested without the button');

  await tool.run('fetchRobotImages')();
  assert.strictEqual(images.length, 1, 'the button did not fetch the avatar');
  assert.ok(images[0].src.startsWith('https://paynym.rs/preview/PM8T'));
  tool.cancelPendingTimers();
});

test('diceware: every roll is a fair die face and every word exists', async () => {
  const { run } = await openTool();
  const rollDie = run('rollDie');
  const counts = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 6000; i++) {
    const face = rollDie();
    assert.ok(Number.isInteger(face) && face >= 1 && face <= 6, `rolled ${face}`);
    counts[face - 1] += 1;
  }
  assert.ok(counts.every((n) => n > 800), `the faces look biased: ${counts}`);
  const getRandomDiceWord = run('getRandomDiceWord');
  for (let i = 0; i < 200; i++) {
    assert.ok(getRandomDiceWord(), 'a roll landed outside the diceware list');
  }
});

test('passphrase tester: a pasted address is shown as text, not run as HTML', async () => {
  const tool = await openTool();
  const { document } = tool;
  tool.run(`bip32RootKey = bip32.fromSeed(bip39.mnemonicToSeedSync('${SEVENF_12}'))`);
  document.getElementById('bip39KnownAddr').value = '<img src=x onerror=alert(1)>';
  document.getElementById('bip39CustomPath').value = "m/86'/0'/0'/0";
  await tool.run('bip39PassphraseTest')();
  tool.cancelPendingTimers();
  const message = document.getElementById('bip39PassTestInfo').innerHTML;
  assert.match(message, /&lt;img src=x onerror=alert\(1\)&gt;/, message);
  assert.doesNotMatch(message, /<img/);
});

(async () => {
  console.log('seed safety');
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
