/**
 * author: Sindre Sorhus
 * license: MIT
 * source: https://github.com/sindresorhus/uint8array-extras
 */
const objectToString = Object.prototype.toString;
const uint8ArrayStringified = "[object Uint8Array]";
const arrayBufferStringified = "[object ArrayBuffer]";

function isType(value, typeConstructor, typeStringified) {
  if (!value) {
    return false;
  }

  if (value.constructor === typeConstructor) {
    return true;
  }

  return objectToString.call(value) === typeStringified;
}

function isUint8Array(value) {
  return isType(value, Uint8Array, uint8ArrayStringified);
}

function isArrayBuffer(value) {
  return isType(value, ArrayBuffer, arrayBufferStringified);
}

function isUint8ArrayOrArrayBuffer(value) {
  return isUint8Array(value) || isArrayBuffer(value);
}

function assertUint8Array(value) {
  if (!isUint8Array(value)) {
    throw new TypeError(`Expected \`Uint8Array\`, got \`${typeof value}\``);
  }
}

function assertUint8ArrayOrArrayBuffer(value) {
  if (!isUint8ArrayOrArrayBuffer(value)) {
    throw new TypeError(`Expected \`Uint8Array\` or \`ArrayBuffer\`, got \`${typeof value}\``);
  }
}

function toUint8Array(value) {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  throw new TypeError(`Unsupported value, got \`${typeof value}\`.`);
}

function concatUint8Arrays(arrays, totalLength) {
  if (arrays.length === 0) {
    return new Uint8Array(0);
  }

  totalLength ??= arrays.reduce((accumulator, currentValue) => accumulator + currentValue.length, 0);

  const returnValue = new Uint8Array(totalLength);

  let offset = 0;
  for (const array of arrays) {
    assertUint8Array(array);
    returnValue.set(array, offset);
    offset += array.length;
  }

  return returnValue;
}

function areUint8ArraysEqual(a, b) {
  assertUint8Array(a);
  assertUint8Array(b);

  if (a === b) {
    return true;
  }

  if (a.length !== b.length) {
    return false;
  }

  // eslint-disable-next-line unicorn/no-for-loop
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
}

function compareUint8Arrays(a, b) {
  assertUint8Array(a);
  assertUint8Array(b);

  const length = Math.min(a.length, b.length);

  for (let index = 0; index < length; index++) {
    const diff = a[index] - b[index];
    if (diff !== 0) {
      return Math.sign(diff);
    }
  }

  // At this point, all the compared elements are equal.
  // The shorter array should come first if the arrays are of different lengths.
  return Math.sign(a.length - b.length);
}

const cachedDecoders = {
  utf8: new globalThis.TextDecoder("utf8"),
};

function uint8ArrayToString(array, encoding = "utf8") {
  assertUint8ArrayOrArrayBuffer(array);
  cachedDecoders[encoding] ??= new globalThis.TextDecoder(encoding);
  return cachedDecoders[encoding].decode(array);
}

function assertString(value) {
  if (typeof value !== "string") {
    throw new TypeError(`Expected \`string\`, got \`${typeof value}\``);
  }
}

const cachedEncoder = new globalThis.TextEncoder();

function stringToUint8Array(string) {
  assertString(string);
  return cachedEncoder.encode(string);
}

function base64ToBase64Url(base64) {
  return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlToBase64(base64url) {
  return base64url.replaceAll("-", "+").replaceAll("_", "/");
}

// Reference: https://phuoc.ng/collection/this-vs-that/concat-vs-push/
const MAX_BLOCK_SIZE = 65_535;

function uint8ArrayToBase64(array, { urlSafe = false } = {}) {
  assertUint8Array(array);

  let base64;

  if (array.length < MAX_BLOCK_SIZE) {
    // Required as `btoa` and `atob` don't properly support Unicode: https://developer.mozilla.org/en-US/docs/Glossary/Base64#the_unicode_problem
    base64 = globalThis.btoa(String.fromCodePoint.apply(this, array));
  } else {
    base64 = "";
    for (const value of array) {
      base64 += String.fromCodePoint(value);
    }

    base64 = globalThis.btoa(base64);
  }

  return urlSafe ? base64ToBase64Url(base64) : base64;
}

function base64ToUint8Array(base64String) {
  assertString(base64String);
  return Uint8Array.from(globalThis.atob(base64UrlToBase64(base64String)), (x) => x.codePointAt(0));
}

function stringToBase64(string, { urlSafe = false } = {}) {
  assertString(string);
  return uint8ArrayToBase64(stringToUint8Array(string), { urlSafe });
}

function base64ToString(base64String) {
  assertString(base64String);
  return uint8ArrayToString(base64ToUint8Array(base64String));
}

const byteToHexLookupTable = Array.from({ length: 256 }, (_, index) => index.toString(16).padStart(2, "0"));

function uint8ArrayToHex(array) {
  assertUint8Array(array);

  // Concatenating a string is faster than using an array.
  let hexString = "";

  // eslint-disable-next-line unicorn/no-for-loop -- Max performance is critical.
  for (let index = 0; index < array.length; index++) {
    hexString += byteToHexLookupTable[array[index]];
  }

  return hexString;
}

const hexToDecimalLookupTable = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  a: 10,
  b: 11,
  c: 12,
  d: 13,
  e: 14,
  f: 15,
  A: 10,
  B: 11,
  C: 12,
  D: 13,
  E: 14,
  F: 15,
};

function hexToUint8Array(hexString) {
  assertString(hexString);

  if (hexString.length % 2 !== 0) {
    throw new Error("Invalid Hex string length.");
  }

  const resultLength = hexString.length / 2;
  const bytes = new Uint8Array(resultLength);

  for (let index = 0; index < resultLength; index++) {
    const highNibble = hexToDecimalLookupTable[hexString[index * 2]];
    const lowNibble = hexToDecimalLookupTable[hexString[index * 2 + 1]];

    if (highNibble === undefined || lowNibble === undefined) {
      throw new Error(`Invalid Hex character encountered at position ${index * 2}`);
    }

    bytes[index] = (highNibble << 4) | lowNibble; // eslint-disable-line no-bitwise
  }

  return bytes;
}

/**
@param {DataView} view
@returns {number}
*/
function getUintBE(view) {
  const { byteLength } = view;

  if (byteLength === 6) {
    return view.getUint16(0) * 2 ** 32 + view.getUint32(2);
  }

  if (byteLength === 5) {
    return view.getUint8(0) * 2 ** 32 + view.getUint32(1);
  }

  if (byteLength === 4) {
    return view.getUint32(0);
  }

  if (byteLength === 3) {
    return view.getUint8(0) * 2 ** 16 + view.getUint16(1);
  }

  if (byteLength === 2) {
    return view.getUint16(0);
  }

  if (byteLength === 1) {
    return view.getUint8(0);
  }
}

/**
@param {Uint8Array} array
@param {Uint8Array} value
@returns {number}
*/
function indexOf(array, value) {
  const arrayLength = array.length;
  const valueLength = value.length;

  if (valueLength === 0) {
    return -1;
  }

  if (valueLength > arrayLength) {
    return -1;
  }

  const validOffsetLength = arrayLength - valueLength;

  for (let index = 0; index <= validOffsetLength; index++) {
    let isMatch = true;
    for (let index2 = 0; index2 < valueLength; index2++) {
      if (array[index + index2] !== value[index2]) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      return index;
    }
  }

  return -1;
}

/**
@param {Uint8Array} array
@param {Uint8Array} value
@returns {boolean}
*/
function includes(array, value) {
  return indexOf(array, value) !== -1;
}

/**
 * @param bytes - The `Uint8Array` to read the 4 bytes from.
 * @param offset - The position in the array where reading should begin.
 * @param littleEndian - If true, interprets the bytes as little-endian; otherwise, big-endian.
 * @returns {number} The 32-bit unsigned integer value.
 * @throws {TypeError} If `bytes` is not a Uint8Array.
 * @throws {RangeError} If the offset is outside the bounds of the `Uint8Array`.
 *
 */

function readUInt32(bytes, offset, littleEndian) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError(`Expected bytes to be Uint8Array, got ${typeof bytes}`);
  }

  if (offset < 0 || offset + 4 > bytes.length) {
    throw new RangeError(`Offset (${offset}) is out of bounds.`);
  }

  if (littleEndian) {
    let num = 0;
    num = ((num << 8) + bytes[offset + 3]) >>> 0;
    num = ((num << 8) + bytes[offset + 2]) >>> 0;
    num = ((num << 8) + bytes[offset + 1]) >>> 0;
    num = ((num << 8) + bytes[offset]) >>> 0;
    return num;
  } else {
    let num = 0;
    num = ((num << 8) + bytes[offset]) >>> 0;
    num = ((num << 8) + bytes[offset + 1]) >>> 0;
    num = ((num << 8) + bytes[offset + 2]) >>> 0;
    num = ((num << 8) + bytes[offset + 3]) >>> 0;
    return num;
  }
}

/**
 * @param bytes - The `Uint8Array` to read the 2 bytes from.
 * @param offset - The position in the array where reading should begin.
 * @param littleEndian - If true, interprets the bytes as little-endian; otherwise, big-endian.
 * @returns {number} The 16-bit unsigned integer value.
 * @throws {TypeError} If `bytes` is not a Uint8Array.
 * @throws {RangeError} If the offset is outside the bounds of the `Uint8Array`.
 *
 */

function readUInt16(bytes, offset, littleEndian) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError(`Expected bytes to be Uint8Array, got ${typeof bytes}`);
  }
  if (offset < 0 || offset + 2 > bytes.length) {
    throw new RangeError(`Offset (${offset}) is out of bounds`);
  }
  if (littleEndian) {
    return (bytes[offset] | (bytes[offset + 1] << 8)) >>> 0;
  } else {
    return (bytes[offset + 1] | (bytes[offset] << 8)) >>> 0;
  }
}

module.exports = {
  isUint8Array, assertUint8Array, assertUint8ArrayOrArrayBuffer, toUint8Array,
  concatUint8Arrays, areUint8ArraysEqual, compareUint8Arrays, uint8ArrayToString,
  stringToUint8Array, uint8ArrayToBase64, base64ToUint8Array, stringToBase64,
  base64ToString, uint8ArrayToHex, hexToUint8Array, getUintBE, indexOf, includes,
  readUInt32, readUInt16
};
