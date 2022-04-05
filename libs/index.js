// import { PaymentCode } from '@samouraiwallet/bip47';
// import * as bitcoin from 'bitcoinjs-lib';
// import
// import { createRequire } from 'module';
// const require = createRequire(import.meta.url);
const bitcoin = require('bitcoinjs-lib');
const bip32 = require('bip32');
const bip39 = require('bip39');
const bip47 = require('./bip47');
const bip85 = require('bip85');

module.exports = { bitcoin, bip32, bip39, bip47, bip85 };
