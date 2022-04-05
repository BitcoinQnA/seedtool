const bip32 = require('bip32');
const { encode, decode } = require('bs58check');
const bech32 = require('bech32');
const createHash = require('create-hash');
const ecc = require('tiny-secp256k1');
const PC_VERSION = 0x47;
const networks = {
  bitcoin: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'bc',
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4,
    },
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
  },

  regtest: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'bcrt',
    bip32: {
      public: 0x043587cf,
      private: 0x04358394,
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
  },

  testnet: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',
    bip32: {
      public: 0x043587cf,
      private: 0x04358394,
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
  },
};

class BIP47 {
  constructor(buf, network = networks.bitcoin) {
    if (buf.length !== 80) throw new TypeError('Invalid buffer length');

    this.version = buf.slice(0, 1);
    if (this.version[0] !== 1)
      throw new TypeError('Only payment codes version 1 are supported');

    this.buf = buf;
    this.network = network;
    console.log('buf :>> ', buf);
    this.root = bip32.fromPublicKey(this.pubKey, this.chainCode, this.network);
  }

  static fromWalletSeed(seedBuffer, id, network) {
    const reserved = Buffer.alloc(13, 0);
    const root = bip32.fromSeed(seedBuffer);
    const coinType =
      network.pubKeyHash === networks.bitcoin.pubKeyHash ? '0' : '1';
    const root_bip47 = root.derivePath(`m/47'/${coinType}'/${id}'`);
    let pc = Buffer.from('0100', 'hex'); // version + options
    pc = Buffer.concat([pc, root_bip47.publicKey]);
    pc = Buffer.concat([pc, root_bip47.chainCode]);
    if (pc.length !== 67)
      throw new TypeError('Missing or wrong publicKey or chainCode');
    pc = Buffer.concat([pc, reserved]); // reserved bytes

    console.log(pc);
    const paymentCodeObject = new BIP47(pc, network);
    paymentCodeObject.root = root_bip47; // store the privkey
    return paymentCodeObject;
  }

  static fromBase58(paymentCodeString, network = networks.bitcoin) {
    const buf = decode(paymentCodeString);
    const version = buf.slice(0, 1);
    if (version[0] !== PC_VERSION) throw new TypeError('Invalid version');
    return new PaymentCode(buf.slice(1), network);
  }

  static fromBuffer(buf, network) {
    return new PaymentCode(buf, network);
  }

  get features() {
    return this.buf.slice(1, 1);
  }

  get pubKey() {
    return this.buf.slice(2, 2 + 33);
  }

  get chainCode() {
    return this.buf.slice(35, 35 + 32);
  }

  get paymentCode() {
    return this.buf;
  }

  toBase58() {
    const version = Buffer.from([PC_VERSION]);
    const buf = Buffer.concat([version, this.buf]);
    return encode(buf);
  }

  _hasPrivKeys() {
    return this.root.privateKey != null;
  }

  derive(index) {
    return this.root.derive(index);
  }

  deriveHardened(index) {
    return this.root.deriveHardened(index);
  }

  getNotificationAddress() {
    const child = this.derive(0);
    return getP2pkhAddress(child.publicKey, this.network);
  }

  derivePaymentPrivateKey(A, idx) {
    if (!ecc.isPoint(A))
      throw new TypeError('Argument is not a valid public key');

    const b_node = this.derive(idx);

    if (!b_node.privateKey)
      throw new Error('Unable to derive node with private key');

    const b = b_node.privateKey;
    const S = ecc.pointMultiply(A, b);

    if (!S) throw new Error('Unable to compute resulting point');

    const Sx = S.slice(1, 33);
    const s = sha256(Buffer.from(Sx));

    if (!ecc.isPrivate(s)) throw new TypeError('Invalid shared secret');

    const paymentPrivateKey = ecc.privateAdd(b, s);

    if (!paymentPrivateKey)
      throw new TypeError('Unable to compute payment private key');

    return Buffer.from(paymentPrivateKey);
  }

  derivePaymentPublicKey(a, idx) {
    if (!ecc.isPrivate(a) && !ecc.isPoint(a))
      throw new TypeError(
        'Argument is neither a valid private key or public key'
      );

    let B = null;
    let S = null;

    if (ecc.isPrivate(a)) {
      // a is a private key
      B = this.derive(idx).publicKey;
      S = ecc.pointMultiply(B, a);
    } else if (ecc.isPoint(a)) {
      if (!this._hasPrivKeys())
        throw new Error(
          'Unable to compute the derivation with a public key provided as argument'
        );
      // a is a public key
      const A = a;
      const b_node = this.derive(idx);

      if (!b_node.privateKey)
        throw new Error('Unable to derive node with private key');

      const b = b_node.privateKey;
      B = b_node.publicKey;
      S = ecc.pointMultiply(A, b);
    }

    if (!B || !ecc.isPoint(B))
      throw new TypeError('Invalid derived public key');

    if (!S) throw new Error('Unable to compute resulting point');

    const Sx = S.slice(1, 33);
    const s = sha256(Buffer.from(Sx));

    if (!ecc.isPrivate(s)) throw new TypeError('Invalid shared secret');

    const EccPoint = ecc.pointFromScalar(s);

    if (!EccPoint) throw new Error('Unable to compute point');

    const paymentPublicKey = ecc.pointAdd(B, EccPoint);

    if (!paymentPublicKey)
      throw new TypeError('Unable to compute payment public key');

    return Buffer.from(paymentPublicKey);
  }

  getPaymentAddress(a, idx, type) {
    const pubkey = this.derivePaymentPublicKey(a, idx);

    if (!pubkey) throw new TypeError('Unable to derive public key');

    switch (type) {
      case 'p2pkh':
        return getP2pkhAddress(pubkey, this.network);
      case 'p2sh':
        return getP2shAddress(pubkey, this.network);
      case 'p2wpkh':
        return getP2wpkhAddress(pubkey, this.network);
      default:
        throw new Error(
          'Address type has not been defined: p2pkh | p2sh | p2wpkh'
        );
    }
  }
}

// Utils

const getP2pkhAddress = (pubkey, network) =>
  toBase58Check(hash160(pubkey), network.pubKeyHash);

const toBase58Check = (hash, version) => {
  const payload = Buffer.allocUnsafe(21);
  payload.writeUInt8(version, 0);
  hash.copy(payload, 1);
  return encode(payload);
};
const hash160 = (buffer) => ripemd160(sha256(buffer));

const sha256 = (buffer) => createHash('sha256').update(buffer).digest();

const ripemd160 = (buffer) => createHash('rmd160').update(buffer).digest();

const getP2shAddress = (pubkey, network) => {
  const push20 = Buffer.from(new Uint8Array([0, 0x14]));
  const scriptSig = Buffer.concat([push20, hash160(pubkey)]);
  return toBase58Check(hash160(scriptSig), network.scriptHash);
};

function getP2wpkhAddress(pubkey, network) {
  const hash = hash160(pubkey);
  const words = bech32.toWords(hash);
  words.unshift(0x00);
  return bech32.encode(network.bech32, words);
}

module.exports = BIP47;
