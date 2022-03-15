const ECPairFactory = require('ecpair');
const ecc = require('tiny-secp256k1');
const bitcoin = require('bitcoinjs-lib');

module.exports = {
  bitcoin,
  ECPair: ECPairFactory(ecc),
};
