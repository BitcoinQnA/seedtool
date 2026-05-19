"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SilentPayment = exports.G = void 0;
const crypto = __importStar(require("crypto"));
const ecpair_1 = require("ecpair");
const bech32_1 = require("bech32");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const bip32_1 = require("bip32");
const bip39 = __importStar(require("bip39"));
const noble_ecc_1 = __importDefault(require("./noble_ecc"));
const uint8array_extras_1 = require("./uint8array-extras");
const ECPair = (0, ecpair_1.ECPairFactory)(noble_ecc_1.default);
bitcoin.initEccLib(noble_ecc_1.default);
const bip32 = (0, bip32_1.BIP32Factory)(noble_ecc_1.default);
exports.G = (0, uint8array_extras_1.hexToUint8Array)("0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798");
class SilentPayment {
    /**
     * Takes the UTXO that the sender is going to spend in a transaction,
     * and an array of Targets which may or may not have
     * SilentPayment identifiers (destinations), and returns an array of
     * Targets which have SilentPayment identifiers unwrapped into taproot addresses.
     * If target initially already had onchain address its skipped.
     * Numeric values (if present) for targets are passed through.
     */
    createTransaction(utxos, targets) {
        const ret = new Array(targets.length);
        const silentPaymentGroups = [];
        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            if (!target.address?.startsWith("sp1")) {
                ret[i] = target; // passthrough
                continue;
            }
            const result = bech32_1.bech32m.decode(target.address, 118);
            const version = result.words.shift();
            if (version !== 0) {
                throw new Error("Unexpected version of silent payment code");
            }
            const data = bech32_1.bech32m.fromWords(result.words);
            const Bscan = new Uint8Array(data.slice(0, 33));
            const Bm = new Uint8Array(data.slice(33));
            // Addresses with the same Bscan key all belong to the same recipient
            const recipient = silentPaymentGroups.find((group) => (0, uint8array_extras_1.compareUint8Arrays)(group.Bscan, Bscan) === 0);
            if (recipient) {
                recipient.BmValues.push([Bm, target.value, i]);
            }
            else {
                silentPaymentGroups.push({
                    Bscan: Bscan,
                    BmValues: [[Bm, target.value, i]],
                });
            }
        }
        if (silentPaymentGroups.length === 0)
            return ret; // passthrough
        const a = SilentPayment._sumPrivkeys(utxos);
        const A = new Uint8Array(noble_ecc_1.default.pointFromScalar(a));
        const outpoint_hash = SilentPayment._outpointsHash(utxos, A);
        // Generating Pmk for each Bm in the group
        for (const group of silentPaymentGroups) {
            // Bscan * a * outpoint_hash
            const ecdh_shared_secret_step1 = new Uint8Array(noble_ecc_1.default.privateMultiply(outpoint_hash, a));
            const ecdh_shared_secret = new Uint8Array(noble_ecc_1.default.getSharedSecret(ecdh_shared_secret_step1, group.Bscan));
            let k = 0;
            for (const [Bm, amount, i] of group.BmValues) {
                const tk = SilentPayment.taggedHash("BIP0352/SharedSecret", (0, uint8array_extras_1.concatUint8Arrays)([ecdh_shared_secret, SilentPayment._ser32(k)]));
                // Let Pmk = tk·G + Bm
                const Pmk = new Uint8Array(noble_ecc_1.default.pointAdd(noble_ecc_1.default.pointMultiply(exports.G, tk), Bm));
                // Encode Pmk as a BIP341 taproot output
                const address = SilentPayment.pubkeyToAddress((0, uint8array_extras_1.uint8ArrayToHex)(Pmk.slice(1)));
                const newTarget = { address };
                newTarget.value = amount;
                ret[i] = newTarget;
                k += 1;
            }
        }
        return ret;
    }
    static taggedHash(tag, data) {
        const hash = crypto.createHash("sha256");
        const tagHash = new Uint8Array(hash.update(tag, "utf-8").digest());
        const ss = (0, uint8array_extras_1.concatUint8Arrays)([tagHash, tagHash, data]);
        return new Uint8Array(crypto.createHash("sha256").update(ss).digest());
    }
    static _outpointsHash(parameters, A) {
        const outpoints = [];
        for (const parameter of parameters) {
            const txidBuffer = (0, uint8array_extras_1.hexToUint8Array)(parameter.txid).reverse();
            const voutBuffer = new Uint8Array(SilentPayment._ser32(parameter.vout).reverse());
            outpoints.push(new Uint8Array([...txidBuffer, ...voutBuffer]));
        }
        outpoints.sort((a, b) => (0, uint8array_extras_1.compareUint8Arrays)(a, b));
        const smallest_outpoint = outpoints[0];
        return SilentPayment.taggedHash("BIP0352/Inputs", (0, uint8array_extras_1.concatUint8Arrays)([smallest_outpoint, A]));
    }
    /**
     * Serializes a 32-bit unsigned integer i as a 4-byte big-endian
     * @param i {number} The number to serialize
     * @returns {Uint8Array} The serialized number
     * @private
     * */
    static _ser32(i) {
        const returnValue = new Uint8Array(4);
        returnValue[0] = (i >> 24) & 0xff;
        returnValue[1] = (i >> 16) & 0xff;
        returnValue[2] = (i >> 8) & 0xff;
        returnValue[3] = i & 0xff;
        return returnValue;
    }
    /**
     * Sums the private keys of the UTXOs
     * @param utxos {UTXO[]}
     * @returns {Uint8Array} The sum of the private keys
     * @private
     **/
    static _sumPrivkeys(utxos) {
        if (utxos.length === 0) {
            throw new Error("No UTXOs provided");
        }
        const keys = [];
        for (const utxo of utxos) {
            let key = ECPair.fromWIF(utxo.wif).privateKey;
            switch (utxo.utxoType) {
                case "non-eligible":
                    // Non-eligible UTXOs can be spent in the transaction, but are not used for the
                    // shared secret derivation. Note: we don't check that the private key is valid
                    // for non-eligible utxos because its possible the sender is following a different
                    // signing protocol for these utxos. For silent payments eligible utxos, we require
                    // access to the private key.
                    break;
                case "p2tr":
                    if (key === undefined) {
                        throw new Error("No private key found for eligible UTXO");
                    }
                    // For taproot, check if the seckey results in an odd y-value and negate if so
                    if (noble_ecc_1.default.pointFromScalar(key)[0] === 0x03) {
                        key = new Uint8Array(noble_ecc_1.default.privateNegate(key));
                    }
                    keys.push(key);
                    break;
                case "p2wpkh":
                case "p2sh-p2wpkh":
                case "p2pkh":
                    if (key === undefined) {
                        throw new Error("No private key found for eligible UTXO");
                    }
                    keys.push(key);
                    break;
            }
        }
        if (keys.length === 0) {
            throw new Error("No eligible UTXOs with private keys found");
        }
        // summary of every item in array
        const ret = keys.reduce((acc, key) => {
            return new Uint8Array(noble_ecc_1.default.privateAdd(acc, key));
        });
        return ret;
    }
    static isPaymentCodeValid(pc) {
        try {
            const result = bech32_1.bech32m.decode(pc, 118);
            const version = result.words.shift();
            if (version !== 0) {
                return false;
            }
        }
        catch (_) {
            return false;
        }
        return true;
    }
    static pubkeyToAddress(hex) {
        const publicKey = (0, uint8array_extras_1.hexToUint8Array)("5120" + hex);
        return bitcoin.address.fromOutputScript(publicKey, bitcoin.networks.bitcoin);
    }
    static addressToPubkey(address) {
        return (0, uint8array_extras_1.uint8ArrayToHex)(bitcoin.address.toOutputScript(address).subarray(2));
    }
    static getPubkeysFromTransactionInputs(tx) {
        const result = [];
        const stackToPubkeys = (stack) => {
            return stack
                .filter((elem) => typeof elem !== "number") // filtering out numbers, leaving only Uint8Array
                .filter((elem) => noble_ecc_1.default.isXOnlyPoint(elem) || bitcoinjs_lib_1.script.isCanonicalPubKey(elem));
        };
        for (const input of tx.ins) {
            const inScript = bitcoinjs_lib_1.script.decompile(input.script);
            if (inScript) {
                // push any pubkeys in the scriptSig
                result.push(...stackToPubkeys(inScript));
                if (inScript.length > 1) {
                    const lastItem = inScript[inScript.length - 1];
                    if (typeof lastItem !== "number") {
                        // If the last item is a buffer, treat as redeemScript and check if we can decompile
                        // and if it has any pubkeys (it might not)
                        const redeemScript = bitcoinjs_lib_1.script.decompile(lastItem);
                        if (redeemScript) {
                            result.push(...stackToPubkeys(redeemScript));
                        }
                    }
                }
            }
            // Find any raw pubkeys in the witness stack
            result.push(...input.witness.filter(bitcoinjs_lib_1.script.isCanonicalPubKey));
            for (const item of input.witness) {
                const maybeScript = bitcoinjs_lib_1.script.decompile(item);
                if (maybeScript) {
                    result.push(...stackToPubkeys(maybeScript));
                }
            }
        }
        return result;
    }
    /**
     * takes decoded bitcoin transaction and computes tweak. some transactions must be augmented with prevout data
     * so the method can successfully discover all pubkeys from inputs (example: `tx.ins[0].script = txPrevout0.outs[0].script;`)
     */
    static computeTweakForTx(tx) {
        // you need the sum of the (eligible) input public keys (call it A), multiplied by the input_hash, i.e,
        // hash(A|smallest_outpoint). this is a public key (33bytes) so this 33 bytes per tx is sent to the client.
        // that would be a tweak (per tx)
        let A = SilentPayment.sumPubKeys(SilentPayment.getPubkeysFromTransactionInputs(tx));
        // looking for smallest outpoint:
        const outpoints = [];
        for (const inn of tx.ins) {
            const txidBuffer = inn.hash;
            const voutBuffer = new Uint8Array(SilentPayment._ser32(inn.index).reverse());
            outpoints.push(new Uint8Array([...txidBuffer, ...voutBuffer]));
        }
        outpoints.sort((a, b) => (0, uint8array_extras_1.compareUint8Arrays)(a, b));
        const smallest_outpoint = outpoints[0];
        const input_hash = SilentPayment.taggedHash("BIP0352/Inputs", (0, uint8array_extras_1.concatUint8Arrays)([smallest_outpoint, A]));
        // finally, computing tweak:
        return noble_ecc_1.default.pointMultiply(A, input_hash);
    }
    static sumPubKeys(pubkeys, compressed = true) {
        if (pubkeys.length === 0)
            return null;
        let result = pubkeys[0];
        for (let i = 1; i < pubkeys.length; i++) {
            const sum = noble_ecc_1.default.pointAdd(result, pubkeys[i], compressed);
            if (!sum)
                return null;
            result = sum;
        }
        if (result.length === 32) {
            // We have an x-only point, need to determine correct parity
            // Use the pointCompress function to get the proper compressed format
            try {
                // Create a temporary compressed point by trying both parities
                // First try even parity (0x02)
                const evenPoint = (0, uint8array_extras_1.concatUint8Arrays)([new Uint8Array([2]), result]);
                if (noble_ecc_1.default.isPoint(evenPoint)) {
                    return noble_ecc_1.default.pointCompress(evenPoint, compressed);
                }
                // If even doesn't work, try odd parity (0x03)
                const oddPoint = (0, uint8array_extras_1.concatUint8Arrays)([new Uint8Array([3]), result]);
                if (noble_ecc_1.default.isPoint(oddPoint)) {
                    return noble_ecc_1.default.pointCompress(oddPoint, compressed);
                }
                return null;
            }
            catch {
                return null;
            }
        }
        return result;
    }
    /**
     * takes BIP-39 mnemonic seed and returns shareable static payment code; also: Bscan, bscan, Bspend, bspend
     */
    static seedToCode(bip39seed, accountNum = 0, passphrase = '') {
        const root = bip32.fromSeed(new Uint8Array(bip39.mnemonicToSeedSync(bip39seed, passphrase)));
        const scanXprv = root.derivePath(`m/352'/0'/${accountNum}'/1'/0`);
        const spendXprv = root.derivePath(`m/352'/0'/${accountNum}'/0'/0`);
        const Bscan = scanXprv.publicKey;
        const bscan = scanXprv.privateKey;
        const Bspend = spendXprv.publicKey;
        const bspend = spendXprv.privateKey;
        const bech32Version = 0;
        const words = [bech32Version].concat(bech32_1.bech32m.toWords((0, uint8array_extras_1.concatUint8Arrays)([Bscan, Bspend])));
        const address = bech32_1.bech32m.encode('sp', words, 1023);
        return { address, Bscan, bscan, Bspend, bspend };
    }
    /**
     * takes a decoded transaction (`bitcoinjs.Transaction.fromHex()` will do fine),
     * takes computed tweak for this transaction, your mnemonic seed, and gives you UTXOs from this transaction
     * that you own. tweak is _not_ calculated here because theoretically it can come from a tweak-indexing backend
     * service.
     */
    static detectOurUtxos(tx, seed, tweakHex) {
        const ret = [];
        const code = SilentPayment.seedToCode(seed);
        const sharedSecret = noble_ecc_1.default.getSharedSecret(code.bscan, (0, uint8array_extras_1.hexToUint8Array)(tweakHex));
        // todo: iterate k (aka label), cause it might be non-zero
        const k = 0;
        const t_k = SilentPayment.taggedHash("BIP0352/SharedSecret", (0, uint8array_extras_1.concatUint8Arrays)([sharedSecret, SilentPayment._ser32(k)]));
        // Compute the expected output pubkey
        const P_k = noble_ecc_1.default.pointAdd(noble_ecc_1.default.pointMultiply(exports.G, t_k), code.Bspend);
        let pubkeyHex = (0, uint8array_extras_1.uint8ArrayToHex)(P_k);
        if (pubkeyHex.startsWith("02") || pubkeyHex.startsWith("03"))
            pubkeyHex = pubkeyHex.substring(2);
        let vout = 0;
        for (const o of tx.outs) {
            if ((0, uint8array_extras_1.uint8ArrayToHex)(o.script) === "5120" + pubkeyHex) {
                // match, that means this output is spendable by us;
                // alternatively, could compare addresses: SilentPayment.pubkeyToAddress(pubkeyHex) === SilentPayment.pubkeyToAddress(o.script)
                // deriving spending privkey for this utxo: d = b_spend + t_k (mod n)
                const d = noble_ecc_1.default.privateAdd(code.bspend, t_k);
                if (!d) {
                    console.log("SilentPayment: Invalid private‐key tweak addition");
                    continue;
                }
                const keyPair = ECPair.fromPrivateKey(d);
                const wif = keyPair.toWIF();
                const u = {
                    txid: tx.getId(),
                    vout,
                    wif,
                    utxoType: "p2tr"
                };
                ret.push(u);
            }
            vout++;
        }
        return ret;
    }
}
exports.SilentPayment = SilentPayment;
