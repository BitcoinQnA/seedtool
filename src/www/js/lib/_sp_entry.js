// Browser entry for the silent-payments toolkit. Bundled via browserify into
// js/lib/sp.js (and then minified). Exposes window.silentPayments.

const { SilentPayment } = require('../../../sp_build/index.js');
const bitcoin = require('bitcoinjs-lib');
const { BIP32Factory } = require('bip32');
const { bech32m } = require('bech32');
const { ECPairFactory } = require('ecpair');
const ecc = require('../../../sp_build/noble_ecc.js').default;

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);

const api = {
  SilentPayment,
  bitcoin,
  bip32,
  bech32m,
  ECPair,

  silentPaymentAddressFromRoot(rootXprv, testnet) {
    testnet = !!testnet;
    const network = testnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
    const root = bip32.fromBase58(rootXprv, network);
    const coin = testnet ? 1 : 0;
    const scanPath = "m/352'/" + coin + "'/0'/1'/0";
    const spendPath = "m/352'/" + coin + "'/0'/0'/0";
    const scanNode = root.derivePath(scanPath);
    const spendNode = root.derivePath(spendPath);
    const scanPubkey = scanNode.publicKey;
    const spendPubkey = spendNode.publicKey;
    const hrp = testnet ? 'tsp' : 'sp';
    const concat = new Uint8Array(66);
    concat.set(scanPubkey, 0);
    concat.set(spendPubkey, 33);
    const words = bech32m.toWords(concat);
    const address = bech32m.encode(hrp, [0].concat(Array.from(words)), 1024);
    return {
      address: address,
      scanPubkeyHex: Buffer.from(scanPubkey).toString('hex'),
      spendPubkeyHex: Buffer.from(spendPubkey).toString('hex'),
      scanPath: scanPath,
      spendPath: spendPath,
    };
  },

  decodeSilentPaymentAddress(addr) {
    const decoded = bech32m.decode(addr, 1024);
    const hrp = decoded.prefix;
    if (hrp !== 'sp' && hrp !== 'tsp') {
      throw new Error('Invalid HRP "' + hrp + '" - expected "sp" or "tsp"');
    }
    const version = decoded.words[0];
    const data = bech32m.fromWords(decoded.words.slice(1));
    if (data.length !== 66) {
      throw new Error('Decoded data is ' + data.length + ' bytes, expected 66');
    }
    return {
      network: hrp === 'tsp' ? 'testnet' : 'mainnet',
      version: version,
      scanPubkey: Buffer.from(data.slice(0, 33)).toString('hex'),
      spendPubkey: Buffer.from(data.slice(33, 66)).toString('hex'),
    };
  },

  computeSenderOutputAddress(opts) {
    const sp = new SilentPayment();
    const utxos = [{ txid: opts.txid, vout: opts.vout, wif: opts.inputWif, utxoType: opts.utxoType }];
    const targets = [{ address: opts.spAddress, value: 0 }];
    const out = sp.createTransaction(utxos, targets);
    if (!out || !out[0] || !out[0].address) {
      throw new Error('Failed to compute output address');
    }
    return out[0].address;
  },
};

module.exports = api;
if (typeof window !== 'undefined') window.silentPayments = api;
