// Entry point browserified into js/lib/message.js - exposes a global
// `messageSigning` with both BIP-137 and BIP-322 sign/verify.
//
// BIP-137 is bitcoinjs-message (legacy P2PKH-style signed messages, also
// supports P2WPKH-in-P2SH via "address type" header byte tricks).
// BIP-322 is bip322-js (works for any address type including P2TR).

const bitcoinjsMessage = require('bitcoinjs-message');
const { Signer, Verifier } = require('bip322-js');

// Keep `this` bound to the original classes - bip322-js's static methods reference
// `this.checkPubKeyCorrespondToAddress` and similar siblings internally.
module.exports = {
  bip137: {
    sign: bitcoinjsMessage.sign.bind(bitcoinjsMessage),
    verify: bitcoinjsMessage.verify.bind(bitcoinjsMessage),
    magicHash: bitcoinjsMessage.magicHash.bind(bitcoinjsMessage),
  },
  bip322: {
    sign: (...args) => Signer.sign(...args),
    verify: (...args) => Verifier.verifySignature(...args),
  },
};
