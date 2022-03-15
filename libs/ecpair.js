const ECPairFactory = require('ecpair').ECPairFactory;
const ecc = require('tiny-secp256k1');

const ECPair = ECPairFactory(ecc);
module.exports = ECPair;
