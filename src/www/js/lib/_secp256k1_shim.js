// Stand-in for the `secp256k1` package in the message signing bundle (see
// build_message.js). bitcoinjs-message signs and recovers with it, and
// bip322-js recovers with it. In a browser build that package falls back to
// elliptic, whose ECDSA signing has a key exposure flaw with no fixed release
// (GHSA-848j-6mx2-7j84), so these calls go to @noble/secp256k1 instead. Only
// the calls those two libraries make are provided.

const secp = require('@noble/secp256k1');
const { hmac } = require('@noble/hashes/hmac');
const { sha256 } = require('@noble/hashes/sha256');

// RFC 6979 nonces need a synchronous HMAC-SHA256
secp.utils.hmacSha256Sync = (key, ...messages) =>
  hmac(sha256, key, secp.utils.concatBytes(...messages));

const bytes = (value, length, name) => {
  const out = Uint8Array.from(value);
  if (out.length !== length) throw new Error(`${name} must be ${length} bytes`);
  return out;
};

const recover = (message, signature, recovery, compressed) => {
  const publicKey = secp.recoverPublicKey(
    bytes(message, 32, 'message'),
    bytes(signature, 64, 'signature'),
    recovery,
    compressed
  );
  if (!publicKey) throw new Error("couldn't recover public key from signature");
  return Buffer.from(publicKey);
};

// secp256k1 v3 API, used by bitcoinjs-message. Deterministic RFC 6979 nonce
// and low-S, as libsecp256k1 does; `data` is extra entropy mixed into it.
exports.sign = (message, privateKey, options = {}) => {
  const [signature, recovery] = secp.signSync(
    bytes(message, 32, 'message'),
    bytes(privateKey, 32, 'private key'),
    {
      recovered: true,
      der: false,
      canonical: true,
      extraEntropy: options.data ? bytes(options.data, 32, 'extra entropy') : undefined,
    }
  );
  return { signature: Buffer.from(signature), recovery };
};

exports.recover = (message, signature, recovery, compressed = true) =>
  recover(message, signature, recovery, compressed);

// secp256k1 v4+ API, used by bip322-js (the arguments come in another order)
exports.ecdsaRecover = (signature, recovery, message, compressed = true) =>
  recover(message, signature, recovery, compressed);
