// Stand-in for the part of elliptic that bip322-js uses (helpers/Key.js):
// converting a public key between compressed and uncompressed form. Keeps
// elliptic, and its flawed ECDSA signing, out of the message signing bundle
// (see build_message.js).

const secp = require('@noble/secp256k1');

class ec {
  constructor(curve) {
    if (curve !== 'secp256k1') {
      throw new Error(`elliptic shim: curve ${curve} is not available`);
    }
  }

  keyFromPublic(publicKey) {
    const point = secp.Point.fromHex(Uint8Array.from(publicKey));
    return {
      getPublic(compressed, encoding) {
        if (encoding !== 'array') {
          throw new Error(`elliptic shim: encoding ${encoding} is not available`);
        }
        return Array.from(point.toRawBytes(compressed));
      },
    };
  }
}

module.exports = { ec };
