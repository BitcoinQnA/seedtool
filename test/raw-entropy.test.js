/*
 * Regression tests for raw entropy mode.
 *
 * Guards against the leading zero bug reported in issue #76:
 * BigInt.prototype.toString(16) emits the minimal hex representation, so a bit
 * string beginning with one or more zero nibbles produced short hex. That hex
 * was then either rejected by entropyToMnemonic ("Invalid entropy") or, where
 * the surviving length happened to still be valid, silently converted into a
 * mnemonic shorter than the entropy supplied.
 *
 * The conversion below mirrors setMnemonicFromRawEntropy in
 * src/www/js/dom.js. dom.js is browser code and cannot be required directly,
 * so the expression is duplicated here. Keep the two in sync.
 */

const assert = require('assert');
const bip39 = require('../src/www/js/lib/bip39.js');

// Conversion used by setMnemonicFromRawEntropy (src/www/js/dom.js).
const bitsToMnemonic = (bits) =>
  bip39.entropyToMnemonic(
    BigInt('0b' + bits)
      .toString(16)
      .padStart(bits.length / 4, '0')
  );

// The pre-fix conversion, kept only to prove these tests would catch a
// regression if the padding were ever removed again.
const bitsToMnemonicUnpadded = (bits) =>
  bip39.entropyToMnemonic(BigInt('0b' + bits).toString(16));

const ENTROPY_LENGTHS = [128, 160, 192, 224, 256];
const WORDS_FOR_BITS = { 128: 12, 160: 15, 192: 18, 224: 21, 256: 24 };

let failures = 0;
const test = (name, fn) => {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
  }
};

console.log('raw entropy conversion');

// Every supported length, with every leading zero nibble count from 0 to 8,
// must round trip back to exactly the bits supplied.
for (const bitLength of ENTROPY_LENGTHS) {
  for (let zeroNibbles = 0; zeroNibbles <= 8; zeroNibbles += 1) {
    const leadingZeros = zeroNibbles * 4;
    const bits =
      '0'.repeat(leadingZeros) +
      '1' +
      '0'.repeat(bitLength - leadingZeros - 1);

    test(`${bitLength} bits, ${zeroNibbles} leading zero nibble(s)`, () => {
      const phrase = bitsToMnemonic(bits);

      assert.strictEqual(
        phrase.split(' ').length,
        WORDS_FOR_BITS[bitLength],
        `expected ${WORDS_FOR_BITS[bitLength]} words, got ${
          phrase.split(' ').length
        }`
      );

      // No entropy may be lost: converting back must reproduce the input.
      const roundTrip = BigInt('0x' + bip39.mnemonicToEntropy(phrase))
        .toString(2)
        .padStart(bitLength, '0');

      assert.strictEqual(roundTrip, bits, 'round trip lost entropy');
    });
  }
}

// The two vectors from issue #76, asserted against their published values.
test('issue #76 case 1: 128 bits with four leading zeros', () => {
  const bits =
    '00001101100111010010111010001101001011100101110100011010010111001011' +
    '110110011101001011101000110100101110010111010001101001011100';
  assert.strictEqual(
    bitsToMnemonic(bits),
    'assault truly person frequent spider comic wait place minor indicate ' +
      'educate ribbon'
  );
  // Previously threw "Invalid entropy" and left the old phrase on screen.
  assert.throws(() => bitsToMnemonicUnpadded(bits), /Invalid entropy/);
});

test('issue #76 case 2: 256 bits with thirty-two leading zeros', () => {
  const bits =
    '00000000000000000000000000000000110110011101001011101000110100101110' +
    '01011101000110100101110010111101100111010010111010001101001011100101' +
    '11010001101001011100101111011001110100101110100011010010111001011101' +
    '0001101001011100101111011001110100101110100011010010';
  assert.strictEqual(
    bitsToMnemonic(bits),
    'abandon abandon ability recipe company harvest nuclear cruise slim ' +
      'soldier riot place fringe spray control demise trip now inner entire ' +
      'rural truly person favorite'
  );
  // Previously produced a silent 21 word phrase built from bits 33 to 256.
  assert.strictEqual(bitsToMnemonicUnpadded(bits).split(' ').length, 21);
});

// The conversion above is a copy, so guard the production source directly:
// if the padding is removed from dom.js these tests must fail.
test('src/www/js/dom.js still pads the hex to full width', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(
    path.join(__dirname, '../src/www/js/dom.js'),
    'utf8'
  );
  const conversion = source
    .slice(source.indexOf('const setMnemonicFromRawEntropy'))
    .slice(0, 1200);

  assert.ok(
    /\.padStart\(\s*bits\.length \/ 4,\s*'0'\s*\)/.test(conversion),
    'setMnemonicFromRawEntropy no longer pads the hex, see issue #76'
  );
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nall tests passed');
