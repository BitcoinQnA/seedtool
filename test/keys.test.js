/*
 * Known-answer tests against published vectors: BIP-39, BIP-32, BIP-85
 * (through the tool's own BIP-85 code), NIP-06, BIP-85 Nostr, BIP-380
 * descriptor checksums, BIP-84/86 addresses from descriptors, and SeedQR.
 * These pin the bundled libraries' behaviour before any library upgrade.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const nodeCrypto = require('crypto');
const jsQRModule = require('jsqr');
const { loadTool } = require('./harness');

const jsQR = jsQRModule.default || jsQRModule;
const WWW = path.join(__dirname, '..', 'src', 'www');
const BIP39_ENGLISH = require('./fixtures/bip39-english.json');

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

const ZERO_12 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const BIP85_MASTER = 'xprv9s21ZrQH143K2LBWUUQRFXhucrQqBpKdRRxNVq2zBqsx8HVqFk2uYo8kmbaLLHRdqtQpUm98uKfu3vca1LqdGhUtyoFnCNkfmXRyPXLjbKb';

const openTool = async () => {
  const tool = loadTool();
  await vm.runInContext('setupDom', tool.context)();
  tool.cancelPendingTimers();
  vm.runInContext(fs.readFileSync(path.join(WWW, 'js', 'keys.js'), 'utf8'), tool.context, { filename: 'keys.js' });
  tool.run = (code) => vm.runInContext(code, tool.context);
  tool.keys = tool.run('seedKeys');
  return tool;
};

const loadMiniscript = () => {
  const context = {
    console, crypto: nodeCrypto.webcrypto, TextEncoder, TextDecoder, AbortController, AbortSignal,
    URL, URLSearchParams, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    atob, btoa, performance, structuredClone, WebAssembly, navigator: { userAgent: 'node' },
  };
  context.window = context;
  context.self = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(WWW, 'js', 'lib', 'miniscript.js'), 'utf8'), context);
  return context.miniscript;
};

// Draw a QR code from the tool's QR library as RGBA pixels for jsQR
const renderQr = (qr, scale = 4, margin = 4) => {
  const n = qr.getModuleCount();
  const size = (n + margin * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const i = (((r + margin) * scale + y) * size + (c + margin) * scale + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width: size, height: size };
};

let failures = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('bip39: all 24 English reference vectors (passphrase TREZOR)', async () => {
  const { run } = await openTool();
  const check = run(`(entropy, mnemonic, seed, xprv) => {
    const out = [];
    out.push(bip39.entropyToMnemonic(entropy) === mnemonic);
    const s = bip39.mnemonicToSeedSync(mnemonic, 'TREZOR');
    out.push(s.toString('hex') === seed);
    out.push(bip32.fromSeed(s).toBase58() === xprv);
    return out.join();
  }`);
  for (const [entropy, mnemonic, seed, xprv] of BIP39_ENGLISH) {
    assert.strictEqual(check(entropy, mnemonic, seed, xprv), 'true,true,true', mnemonic);
  }
});

test('bip32: test vector 1', async () => {
  const { run } = await openTool();
  const node = run("bip32.fromSeed(Buffer.Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex'))");
  const chains = {
    m: ['xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi', 'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8'],
    "m/0'": ['xprv9uHRZZhk6KAJC1avXpDAp4MDc3sQKNxDiPvvkX8Br5ngLNv1TxvUxt4cV1rGL5hj6KCesnDYUhd7oWgT11eZG7XnxHrnYeSvkzY7d2bhkJ7', 'xpub68Gmy5EdvgibQVfPdqkBBCHxA5htiqg55crXYuXoQRKfDBFA1WEjWgP6LHhwBZeNK1VTsfTFUHCdrfp1bgwQ9xv5ski8PX9rL2dZXvgGDnw'],
    "m/0'/1": ['xprv9wTYmMFdV23N2TdNG573QoEsfRrWKQgWeibmLntzniatZvR9BmLnvSxqu53Kw1UmYPxLgboyZQaXwTCg8MSY3H2EU4pWcQDnRnrVA1xe8fs', 'xpub6ASuArnXKPbfEwhqN6e3mwBcDTgzisQN1wXN9BJcM47sSikHjJf3UFHKkNAWbWMiGj7Wf5uMash7SyYq527Hqck2AxYysAA7xmALppuCkwQ'],
    "m/0'/1/2'": ['xprv9z4pot5VBttmtdRTWfWQmoH1taj2axGVzFqSb8C9xaxKymcFzXBDptWmT7FwuEzG3ryjH4ktypQSAewRiNMjANTtpgP4mLTj34bhnZX7UiM', 'xpub6D4BDPcP2GT577Vvch3R8wDkScZWzQzMMUm3PWbmWvVJrZwQY4VUNgqFJPMM3No2dFDFGTsxxpG5uJh7n7epu4trkrX7x7DogT5Uv6fcLW5'],
  };
  for (const [chain, [xprv, xpub]] of Object.entries(chains)) {
    const child = chain === 'm' ? node : node.derivePath(chain);
    assert.strictEqual(child.toBase58(), xprv, chain);
    assert.strictEqual(child.neutered().toBase58(), xpub, chain);
  }
});

test('bip85: raw derivations, test cases 1 and 2', async () => {
  const { run } = await openTool();
  const derive = run(`(path) => bip85.BIP85.fromBase58('${BIP85_MASTER}').derive(path)`);
  assert.strictEqual(derive("m/83696968'/0'/0'"), 'efecfbccffea313214232d29e71563d941229afb4338c21f9517c41aaa0d16f00b83d2a09ef747e7a64e8e2bd5a14869e693da66ce94ac2da570ab7ee48618f7');
  assert.strictEqual(derive("m/83696968'/0'/1'"), '70c6e3e8ebee8dc4c0dbba66076819bb8c09672527c4277ca8729532ad711872218f826919f6b67218adde99018a6df9095ab2b58d803b5b93ec9802085a690e');
});

test('bip85: the tool derives the spec child for each application', async () => {
  const tool = await openTool();
  const { DOM, run } = tool;
  DOM.bip32RootKey.value = BIP85_MASTER;
  // The stand-in DOM has no parent elements; calcBip85 shows and hides the
  // rows around its length and byte fields
  for (const el of [DOM.bip85MnemonicLength, DOM.bip85Bytes]) {
    el.parentElement = { classList: { add() {}, remove() {} } };
  }
  const calcBip85 = run('calcBip85');
  const child = async (app, extra) => {
    DOM.bip85Application.value = app;
    DOM.bip85Index.value = '0';
    if (extra) extra();
    await calcBip85();
    tool.cancelPendingTimers();
    return DOM.bip85ChildKey.value;
  };
  const words = { 12: 'girl mad pet galaxy egg matter matrix prison refuse sense ordinary nose', 18: 'near account window bike charge season chef number sketch tomorrow excuse sniff circle vital hockey outdoor supply token', 24: 'puppy ocean match cereal symbol another shed magic wrap hammer bulb intact gadget divorce twin tonight reason outdoor destroy simple truth cigar social volcano' };
  for (const [length, mnemonic] of Object.entries(words)) {
    assert.strictEqual(await child('bip39', () => { DOM.bip85MnemonicLength.value = length; }), mnemonic, `${length} words`);
  }
  assert.strictEqual(await child('wif'), 'Kzyv4uF39d4Jrw2W7UryTHwZr1zQVNk4dAFyqE6BuMrMh1Za7uhp');
  assert.strictEqual(await child('xprv'), 'xprv9s21ZrQH143K2srSbCSg4m4kLvPMzcWydgmKEnMmoZUurYuBuYG46c6P71UGXMzmriLzCCBvKQWBUv3vPB3m1SATMhp3uEjXHJ42jFg7myX');
  assert.strictEqual(await child('hex', () => { DOM.bip85Bytes.value = '64'; }), '492db4698cf3b73a5a24998aa3e9d7fa96275d85724a91e71aa2d645442f878555d078fd1f1f67e368976f04137b1f7a0d19232136ca50c44614af72b5582a5c');

  DOM.bip85PWDLength.value = '21';
  DOM.bip85PWDIndex.value = '0';
  await run('calcBip85Password')();
  tool.cancelPendingTimers();
  assert.strictEqual(DOM.bip85PWDPassword.value, 'dKLoepugzdVJvdL56ogNV');
});

test('nip06: both reference vectors', async () => {
  const { run, keys } = await openTool();
  const root = (mnemonic) => run(`bip32.fromSeed(bip39.mnemonicToSeedSync('${mnemonic}')).toBase58()`);
  const vectors = [
    ['leader monkey parrot ring guide accident before fence cannon height naive bean', '7f7ff03d123792d6ac594bfa67bf6d0c0ab55b6b1fdb6249303fe861f1ccba9a', 'nsec10allq0gjx7fddtzef0ax00mdps9t2kmtrldkyjfs8l5xruwvh2dq0lhhkp', '17162c921dc4d2518f9a101db33695df1afb56ab82f5ff3e5da6eec3ca5cd917', 'npub1zutzeysacnf9rru6zqwmxd54mud0k44tst6l70ja5mhv8jjumytsd2x7nu'],
    ['what bleak badge arrange retreat wolf trade produce cricket blur garlic valid proud rude strong choose busy staff weather area salt hollow arm fade', 'c15d739894c81a2fcfd3a2df85a0d2c0dbc47a280d092799f144d73d7ae78add', 'nsec1c9wh8xy5eqdzln7n5t0ctgxjcrdug73gp5yj0x03gntn67h83twssdfhel', 'd41b22899549e1f3d335a31002cfd382174006e166d3e658e3a5eecdb6463573', 'npub16sdj9zv4f8sl85e45vgq9n7nsgt5qphpvmf7vk8r5hhvmdjxx4es8rq74h'],
  ];
  for (const [mnemonic, privateKeyHex, nsec, publicKeyHex, npub] of vectors) {
    const got = keys.nip06(root(mnemonic), 0);
    assert.deepStrictEqual(
      { path: got.path, privateKeyHex: got.privateKeyHex, nsec: got.nsec, publicKeyHex: got.publicKeyHex, npub: got.npub },
      { path: "m/44'/1237'/0'/0/0", privateKeyHex, nsec, publicKeyHex, npub }
    );
  }
  assert.throws(() => keys.nip06(root(vectors[0][0]), -1), /whole number/);
});

test('bip85 nostr: the three reference vectors, and index 0 is refused', async () => {
  const { keys } = await openTool();
  const vectors = [
    [1, 1, 'ff6eb0fcdf1ef87a2a06b0d7884d495b486d0faa210e9f80f23fd649d6e114d27873d12f3b57c469f684e4dc9f4abf10beeacb59b385fde8e33f1947bc5c6c17', 'nsec1lahtplxlrmu852sxkrtcsn2ftdyx6ra2yy8flq8j8ltyn4hpznfq23uvqz'],
    [1, 2, '917628689652288f6983c8a01db516d0697d5198dcf9de9010597f5e322fba6e435a731d85fbcc5768c06ff95ff34bf577f63f415cb170473659753acf14722d', 'nsec1j9mzs6yk2g5g76vrezspmdgk6p5h65vcmnuaayqst9l4uv30hfhqje0jyh'],
    [2, 1, 'fa2e784291b1fd347ba3624672e3090cb2cee34b8567180336e3aa290d02715b8f4b18f02f07cb2aa3023afd34735282cc6594370f47e6e1fa48d8d0dda93096', 'nsec1lgh8ss53k87ng7arvfr89ccfpjevac6ts4n3sqekuw4zjrgzw9dsq3uelh'],
  ];
  for (const [identity, account, entropyHex, nsec] of vectors) {
    const got = keys.bip85Nostr(BIP85_MASTER, identity, account);
    assert.strictEqual(got.path, `m/83696968'/128002'/${identity}'/${account}'`);
    assert.strictEqual(got.entropyHex, entropyHex);
    assert.strictEqual(got.nsec, nsec);
    assert.match(got.npub, /^npub1[02-9ac-hj-np-z]{58}$/);
  }
  assert.throws(() => keys.bip85Nostr(BIP85_MASTER, 0, 1), /from 1/);
  assert.throws(() => keys.bip85Nostr(BIP85_MASTER, 1, 0), /from 1/);
});

test('bip380: descriptor checksum reference vector', async () => {
  const { keys } = await openTool();
  assert.strictEqual(keys.withChecksum('raw(deadbeef)'), 'raw(deadbeef)#89f8spxm');
  assert.throws(() => keys.descriptorChecksum('raw(Ü)'), /not allowed/);
});

test('descriptors: BIP-84 and BIP-86 descriptors derive the spec addresses', async () => {
  const { run, keys } = await openTool();
  const ms = loadMiniscript();
  await ms.ready;
  const root = run(`bip32.fromSeed(bip39.mnemonicToSeedSync('${ZERO_12}')).toBase58()`);

  const d84 = keys.singleSigDescriptors(root, { purpose: 84 });
  assert.strictEqual(d84.fingerprint, '73c5da0a');
  assert.match(d84.combined, /^wpkh\(\[73c5da0a\/84h\/0h\/0h\]xpub[1-9A-HJ-NP-Za-km-z]+\/<0;1>\/\*\)#[a-z0-9]{8}$/);
  assert.ok(JSON.stringify(ms.deriveAddresses(d84.receive)).includes('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu'));

  const d86 = keys.singleSigDescriptors(root, { purpose: 86 });
  assert.ok(JSON.stringify(ms.deriveAddresses(d86.receive)).includes('bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr'));

  // Every checksum, including the multipath forms, matches the one the
  // @bitcoinerlab/descriptors library computes on its own
  const { checksum: libraryChecksum } = require('@bitcoinerlab/descriptors');
  for (const purpose of [44, 49, 84, 86]) {
    const d = keys.singleSigDescriptors(root, { purpose });
    for (const desc of [d.receive, d.change, d.combined]) {
      const [body, sum] = desc.split('#');
      assert.strictEqual(sum, libraryChecksum(body), desc);
    }
  }

  // Legacy and nested SegWit: first receive address matches a direct derivation
  const expect44 = run(`bitcoin.payments.p2pkh({ pubkey: bip32.fromBase58('${root}').derivePath("m/44'/0'/0'/0/0").publicKey }).address`);
  const expect49 = run(`bitcoin.payments.p2sh({ redeem: bitcoin.payments.p2wpkh({ pubkey: bip32.fromBase58('${root}').derivePath("m/49'/0'/0'/0/0").publicKey }) }).address`);
  assert.ok(JSON.stringify(ms.deriveAddresses(keys.singleSigDescriptors(root, { purpose: 44 }).receive)).includes(expect44));
  assert.ok(JSON.stringify(ms.deriveAddresses(keys.singleSigDescriptors(root, { purpose: 49 }).receive)).includes(expect49));

  const testnet = keys.singleSigDescriptors(root, { purpose: 84, coin: 1, testnet: true });
  assert.match(testnet.receive, /^wpkh\(\[73c5da0a\/84h\/1h\/0h\]tpub/);
  assert.throws(() => keys.singleSigDescriptors(root, { purpose: 48 }), /no standard/);
});

test('seedqr: the spec example, round trips and rejections', async () => {
  const { run, keys } = await openTool();
  const example = 'vacuum bridge buddy supreme exclude milk consider tail expand wasp pattern nuclear';
  const digits = '192402220235174306311124037817700641198012901210';
  assert.strictEqual(keys.mnemonicToSeedQrDigits(example), digits);
  assert.strictEqual(keys.seedQrDigitsToMnemonic(digits), example);

  const generate = run('(bits) => bip39.generateMnemonic(bits)');
  for (const bits of [128, 160, 192, 224, 256]) {
    const mnemonic = generate(bits);
    assert.strictEqual(keys.seedQrDigitsToMnemonic(keys.mnemonicToSeedQrDigits(mnemonic)), mnemonic);
    const entropy = Buffer.from(run('bip39.mnemonicToEntropy')(mnemonic), 'hex');
    const scanned = keys.mnemonicFromQr({ text: 'x', bytes: Array.from(entropy) });
    // A random entropy can, very rarely, be all printable; retry is not needed for the fixed vector below
    if (scanned.format === 'Compact SeedQR') assert.strictEqual(scanned.mnemonic, mnemonic);
  }
  const zeroCompact = keys.mnemonicFromQr({ text: '', bytes: new Array(16).fill(0) });
  assert.deepStrictEqual({ ...zeroCompact }, { format: 'Compact SeedQR', mnemonic: ZERO_12 });

  assert.throws(() => keys.seedQrDigitsToMnemonic('2048' + digits.slice(4)), /not a BIP39 word number/);
  // Flipping the lowest bit of the last word changes only a checksum bit
  assert.throws(() => keys.seedQrDigitsToMnemonic(digits.slice(0, -4) + '1211'), /checksum/);
  assert.throws(() => keys.seedQrDigitsToMnemonic('123'), /4-digit/);
  assert.throws(() => keys.mnemonicFromQr({ text: 'hello world 1234', bytes: Array.from(Buffer.from('hello world 1234')) }), /does not hold a seed/);
  assert.strictEqual(keys.mnemonicFromQr({ text: ZERO_12.toUpperCase(), bytes: [] }).mnemonic, ZERO_12);
});

test('qr: standard SeedQR is numeric mode, the SeedSigner sizes, and decodes', async () => {
  const { run, keys } = await openTool();
  const make = run(`(data, mode) => { const qr = new QRCode(0, 'L'); qr.addData(data, mode); qr.make(); return qr; }`);
  const example12 = keys.mnemonicToSeedQrDigits('vacuum bridge buddy supreme exclude milk consider tail expand wasp pattern nuclear');
  const qr12 = make(example12, 'Numeric');
  assert.strictEqual(qr12.getModuleCount(), 25, '12 words should be a 25x25 SeedQR');
  const img12 = renderQr(qr12);
  assert.strictEqual(jsQR(img12.data, img12.width, img12.height).data, example12);

  const example24 = keys.mnemonicToSeedQrDigits(`${'abandon '.repeat(23)}art`);
  const qr24 = make(example24, 'Numeric');
  assert.strictEqual(qr24.getModuleCount(), 29, '24 words should be a 29x29 SeedQR');
  const img24 = renderQr(qr24);
  assert.strictEqual(jsQR(img24.data, img24.width, img24.height).data, example24);

  // Byte mode (Compact SeedQR, addresses) still decodes to the same bytes
  const bytes = Array.from(nodeCrypto.randomBytes(16));
  const qrBytes = make(JSON.stringify(bytes));
  const imgBytes = renderQr(qrBytes);
  assert.deepStrictEqual(jsQR(imgBytes.data, imgBytes.width, imgBytes.height).binaryData, bytes);
  const text = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu';
  const imgText = renderQr(make(text));
  assert.strictEqual(jsQR(imgText.data, imgText.width, imgText.height).data, text);

  assert.throws(() => make('12a4', 'Numeric'), /digits/);
});

test('shake256: the FIPS 202 empty-input vector, and Node for other lengths', async () => {
  const { keys } = await openTool();
  const hex = (bytes) => Buffer.from(bytes).toString('hex');
  assert.strictEqual(
    hex(keys.shake256(new Uint8Array(0), 32)),
    '46b9dd2b0ba88d13233b3feb743eeb243fcd52ea62b81b82b50c27646ed5762f'
  );
  for (const length of [0, 1, 64, 135, 136, 137, 300]) {
    for (const out of [1, 80, 136, 137, 500]) {
      const input = nodeCrypto.randomBytes(length);
      const want = nodeCrypto.createHash('shake256', { outputLength: out }).update(input).digest('hex');
      assert.strictEqual(hex(keys.shake256(Uint8Array.from(input), out)), want, `${length} bytes in, ${out} out`);
    }
  }
});

test('base85: matches Python base64.b85encode', async () => {
  const { keys } = await openTool();
  assert.strictEqual(keys.base85Encode(new Uint8Array(4)), '00000');
  assert.strictEqual(keys.base85Encode(Uint8Array.of(255, 255, 255, 255)), '|NsC0');
  assert.throws(() => keys.base85Encode(new Uint8Array(3)), /multiple of 4/);
});

test('bip85: PWD BASE64, PWD BASE85 and DICE spec vectors', async () => {
  const { keys } = await openTool();
  const base64 = keys.bip85Password(BIP85_MASTER, { format: 'base64', length: 21, index: 0 });
  assert.strictEqual(base64.path, "m/83696968'/707764'/21'/0'");
  assert.strictEqual(base64.password, 'dKLoepugzdVJvdL56ogNV');
  const base85 = keys.bip85Password(BIP85_MASTER, { format: 'base85', length: 12, index: 0 });
  assert.strictEqual(base85.path, "m/83696968'/707785'/12'/0'");
  assert.strictEqual(base85.password, '_s`{TW89)i4`');
  const dice = keys.bip85Dice(BIP85_MASTER, { sides: 6, rolls: 10, index: 0 });
  assert.strictEqual(dice.path, "m/83696968'/89101'/6'/10'/0'");
  assert.strictEqual(dice.rolls.join(','), '1,0,0,2,0,1,5,5,2,4');

  assert.throws(() => keys.bip85Password(BIP85_MASTER, { format: 'base85', length: 9 }), /10 to 80/);
  assert.throws(() => keys.bip85Password(BIP85_MASTER, { format: 'base64', length: 87 }), /20 to 86/);
  assert.throws(() => keys.bip85Password(BIP85_MASTER, { format: 'hex', length: 20 }), /Unknown password format/);
  assert.throws(() => keys.bip85Dice(BIP85_MASTER, { sides: 1 }), /Sides/);
});

(async () => {
  console.log('reference vectors and keys');
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
