// Stand-in for Node's crypto module in the Silent Payments bundle (see
// build_sp.js). The bundled code only calls createHash('sha256'),
// createHmac('sha256') and randomBytes, so only those are provided; anything
// else throws rather than quietly returning a wrong value.

const { sha256 } = require('@noble/hashes/sha256');
const { hmac } = require('@noble/hashes/hmac');

const toBytes = (data) =>
  typeof data === 'string' ? new TextEncoder().encode(data) : Uint8Array.from(data);

const output = (bytes, encoding) =>
  encoding === 'hex' ? Buffer.from(bytes).toString('hex') : Buffer.from(bytes);

const onlySha256 = (algorithm) => {
  if (String(algorithm).toLowerCase() !== 'sha256') {
    throw new Error(`crypto shim: ${algorithm} is not available in this bundle`);
  }
};

const wrap = (hasher) => ({
  update(data) {
    hasher.update(toBytes(data));
    return this;
  },
  digest(encoding) {
    return output(hasher.digest(), encoding);
  },
});

exports.createHash = (algorithm) => {
  onlySha256(algorithm);
  return wrap(sha256.create());
};

exports.createHmac = (algorithm, key) => {
  onlySha256(algorithm);
  return wrap(hmac.create(sha256, toBytes(key)));
};

exports.randomBytes = (size) =>
  Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(size)));
