/*
 * Tests for the QR scanning bundle (js/lib/qrscan.js): decoding QR codes the
 * tool itself draws (SeedQR, Compact SeedQR, text) and putting animated UR
 * codes back together from frames that arrive out of order, repeated or with
 * gaps, as a camera sees them.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const nodeCrypto = require('crypto');
const { UR, UREncoder } = require('@ngraveio/bc-ur');
const { loadTool } = require('./harness');

const WWW = path.join(__dirname, '..', 'src', 'www');

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

const loadQrScan = () => {
  const context = {
    console, crypto: nodeCrypto.webcrypto, TextEncoder, TextDecoder, AbortController, AbortSignal,
    URL, URLSearchParams, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    atob, btoa, performance, structuredClone, navigator: { userAgent: 'node' },
  };
  context.window = context;
  context.self = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(WWW, 'js', 'lib', 'qrscan.js'), 'utf8'), context);
  if (!context.qrScan) throw new Error('qrScan was not set');
  return context.qrScan;
};

// The page's QR library and SeedQR helpers, after the page has set up (the
// word list the tool draws Compact SeedQRs from is loaded by setupDom)
const openTool = async () => {
  const tool = loadTool();
  await vm.runInContext('setupDom', tool.context)();
  tool.cancelPendingTimers();
  vm.runInContext(fs.readFileSync(path.join(WWW, 'js', 'keys.js'), 'utf8'), tool.context);
  tool.run = (code) => vm.runInContext(code, tool.context);
  tool.qr = tool.run(`(data, mode) => { const qr = new QRCode(0, 'L'); qr.addData(data, mode); qr.make(); return qr; }`);
  return tool;
};

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

const DEMO_PSBT = fs.readFileSync(path.join(WWW, 'js', 'shell.js'), 'utf8').match(/DEMO_PSBT_B64 = '([^']+)'/)[1];

// Animated UR frames for a payload, as a wallet would show them
const urFrames = (payload, type, fragment = 60) => {
  const base = UR.fromBuffer(Buffer.from(payload));
  const ur = type === 'bytes' ? base : new UR(base.cbor, type);
  const encoder = new UREncoder(ur, fragment);
  const count = encoder.fragmentsLength;
  const frames = [];
  for (let i = 0; i < count * 3; i++) frames.push(encoder.nextPart());
  return { frames, count };
};

const shuffle = (list) => {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = nodeCrypto.randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

let failures = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('decode: SeedQR, Compact SeedQR and text drawn by the tool', async () => {
  const scan = loadQrScan();
  const tool = await openTool();
  const keys = tool.run('seedKeys');
  const mnemonic = tool.run('bip39.generateMnemonic(256)');

  const digits = keys.mnemonicToSeedQrDigits(mnemonic);
  const seedQr = scan.decode(renderQr(tool.qr(digits, 'Numeric')));
  assert.strictEqual(keys.mnemonicFromQr(seedQr).mnemonic, mnemonic);
  assert.strictEqual(keys.mnemonicFromQr(seedQr).format, 'SeedQR');

  // Compact SeedQR is raw entropy in byte mode, drawn the way the tool does it
  const compactBytes = tool.run('phraseToCompactQrBytes')(mnemonic);
  const compact = scan.decode(renderQr(tool.qr(compactBytes)));
  const found = keys.mnemonicFromQr(compact);
  assert.strictEqual(found.format, 'Compact SeedQR');
  assert.strictEqual(found.mnemonic, mnemonic);

  const text = scan.decode(renderQr(tool.qr('ur:crypto-psbt/hello')));
  assert.strictEqual(text.text, 'ur:crypto-psbt/hello');
  assert.strictEqual(scan.decode({ data: new Uint8ClampedArray(64 * 64 * 4).fill(255), width: 64, height: 64 }), null);
});

test('ur: the demo PSBT comes back from shuffled frames with gaps', () => {
  const scan = loadQrScan();
  const psbt = Buffer.from(DEMO_PSBT, 'base64');
  for (const type of ['crypto-psbt', 'psbt']) {
    const { frames, count } = urFrames(psbt, type);
    assert.ok(count > 3, 'the demo PSBT should need several frames');
    const collector = scan.createUrCollector();
    let result = null;
    let fed = 0;
    // Drop every fourth frame and deliver the rest out of order
    for (const frame of shuffle(frames).filter((_, i) => i % 4 !== 3)) {
      fed += 1;
      result = collector.receive(frame);
      if (result.done) break;
      assert.ok(!result.error, result.error);
    }
    assert.ok(result && result.done, `${type}: not complete after ${fed} frames`);
    assert.strictEqual(result.type, type);
    assert.ok(scan.PSBT_UR_TYPES.includes(result.type));
    assert.strictEqual(Buffer.from(result.bytes).toString('base64'), DEMO_PSBT);
  }
});

test('ur: frames read from QR images, uppercase as wallets often show them', async () => {
  const scan = loadQrScan();
  const tool = await openTool();
  const psbt = Buffer.from(DEMO_PSBT, 'base64');
  const { frames } = urFrames(psbt, 'crypto-psbt', 80);
  const collector = scan.createUrCollector();
  let result = null;
  for (const frame of frames) {
    const seen = scan.decode(renderQr(tool.qr(frame.toUpperCase())));
    assert.ok(seen, 'a UR frame did not decode');
    result = collector.receive(seen.text);
    if (result.done) break;
  }
  assert.ok(result.done, 'frames from images did not complete the PSBT');
  assert.strictEqual(Buffer.from(result.bytes).toString('base64'), DEMO_PSBT);
});

test('ur: a single-frame UR, other UR types, and rejections', () => {
  const scan = loadQrScan();
  const small = nodeCrypto.randomBytes(20);
  const { frames } = urFrames(small, 'crypto-psbt', 200);
  const single = scan.createUrCollector().receive(frames[0]);
  assert.ok(single.done);
  assert.deepStrictEqual(Buffer.from(single.bytes), small);

  const other = scan.createUrCollector().receive(urFrames(small, 'bytes', 200).frames[0]);
  assert.ok(other.done);
  assert.strictEqual(other.type, 'bytes');
  assert.ok(!scan.PSBT_UR_TYPES.includes(other.type));

  assert.match(scan.createUrCollector().receive('cHNidP8BAH0CAAAAA').error, /not part of a UR/);
  // A damaged frame is not accepted as a finished code
  assert.ok(!scan.createUrCollector().receive('ur:crypto-psbt/1-3/xyz').done);
});

(async () => {
  console.log('qr scanning');
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
