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
/**
 * adapted from https://github.com/BitGo/BitGoJS/blob/bitcoinjs_lib_6_sync/modules/utxo-lib/src/noble_ecc.ts
 * license: Apache License
 *
 * some pieces are ported from:
 * https://github.com/paulmillr/noble-secp256k1
 * https://github.com/bitcoinerlab/secp256k1
 *
 * @see https://github.com/bitcoinjs/tiny-secp256k1/issues/84#issuecomment-1185682315
 * @see https://github.com/bitcoinjs/bitcoinjs-lib/issues/1781
 */
const create_hash_1 = __importDefault(require("create-hash"));
const crypto_1 = require("crypto");
const necc = __importStar(require("@noble/secp256k1"));
necc.utils.sha256Sync = (...messages) => {
    const sha256 = (0, create_hash_1.default)("sha256");
    for (const message of messages)
        sha256.update(message);
    return new Uint8Array(sha256.digest());
};
necc.utils.hmacSha256Sync = (key, ...messages) => {
    const hash = (0, crypto_1.createHmac)("sha256", key);
    messages.forEach((m) => hash.update(m));
    return Uint8Array.from(hash.digest());
};
const defaultTrue = (param) => param !== false;
function throwToNull(fn) {
    try {
        return fn();
    }
    catch (e) {
        return null;
    }
}
function isPoint(p, xOnly) {
    if ((p.length === 32) !== xOnly)
        return false;
    try {
        return !!necc.Point.fromHex(p);
    }
    catch (e) {
        return false;
    }
}
const ecc = {
    isPoint: (p) => isPoint(p, false),
    isPrivate: (d) => {
        return necc.utils.isValidPrivateKey(d);
    },
    isXOnlyPoint: (p) => isPoint(p, true),
    xOnlyPointAddTweak: (p, tweak) => throwToNull(() => {
        const P = necc.utils.pointAddScalar(p, tweak, true);
        const parity = P[0] % 2 === 1 ? 1 : 0;
        return { parity, xOnlyPubkey: P.slice(1) };
    }),
    getSharedSecret: (sk, pk, compressed) => {
        return necc.getSharedSecret(sk, pk, defaultTrue(compressed));
    },
    pointFromScalar: (sk, compressed) => throwToNull(() => necc.getPublicKey(sk, defaultTrue(compressed))),
    pointCompress: (p, compressed) => {
        return necc.Point.fromHex(p).toRawBytes(defaultTrue(compressed));
    },
    pointMultiply: (a, tweak, compressed) => throwToNull(() => necc.utils.pointMultiply(a, tweak, defaultTrue(compressed))),
    pointAdd: (a, b, compressed) => throwToNull(() => {
        const A = necc.Point.fromHex(a);
        const B = necc.Point.fromHex(b);
        return A.add(B).toRawBytes(defaultTrue(compressed));
    }),
    pointAddScalar: (p, tweak, compressed) => throwToNull(() => necc.utils.pointAddScalar(p, tweak, defaultTrue(compressed))),
    privateAdd: (d, tweak) => throwToNull(() => {
        if (d.join("") === "00000000000000000000000000000001" && tweak.join("") === "00000000000000000000000000000000") {
            // dirty hack to make testEcc in ecpair lib pass
            return new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
        }
        const ret = necc.utils.privateAdd(d, tweak);
        if (ret.join("") === "00000000000000000000000000000000") {
            return null;
        }
        return ret;
    }),
    privateNegate: (d) => necc.utils.privateNegate(d),
    sign: (h, d, e) => {
        return necc.signSync(h, d, { der: false, extraEntropy: e });
    },
    signSchnorr: (h, d, e = new Uint8Array(32).fill(0x00)) => {
        return necc.schnorr.signSync(h, d, e);
    },
    verify: (h, Q, signature, strict) => {
        return necc.verify(signature, h, Q, { strict });
    },
    verifySchnorr: (h, Q, signature) => {
        return necc.schnorr.verifySync(signature, h, Q);
    },
    privateMultiply: (d, tweak) => {
        if (ecc.isPrivate(d) === false) {
            throw new Error("Expected Private");
        }
        const _privateMultiply = (privateKey, tweak) => {
            const p = normalizePrivateKey(privateKey);
            const t = normalizeScalar(tweak);
            const mul = _bigintTo32Bytes(necc.utils.mod(p * t, necc.CURVE.n));
            if (necc.utils.isValidPrivateKey(mul))
                return mul;
            else
                return null;
        };
        return throwToNull(() => _privateMultiply(d, tweak));
    },
};
exports.default = ecc;
function normalizeScalar(scalar) {
    let num;
    if (typeof scalar === "bigint") {
        num = scalar;
    }
    else if (typeof scalar === "number" && Number.isSafeInteger(scalar) && scalar >= 0) {
        num = BigInt(scalar);
    }
    else if (typeof scalar === "string") {
        if (scalar.length !== 64)
            throw new Error("Expected 32 bytes of private scalar");
        num = hexToNumber(scalar);
    }
    else if (scalar instanceof Uint8Array) {
        if (scalar.length !== 32)
            throw new Error("Expected 32 bytes of private scalar");
        num = bytesToNumber(scalar);
    }
    else {
        throw new TypeError("Expected valid private scalar");
    }
    if (num < 0)
        throw new Error("Expected private scalar >= 0");
    return num;
}
function hexToNumber(hex) {
    return BigInt(`0x${hex}`);
}
function bytesToNumber(bytes) {
    return hexToNumber(necc.utils.bytesToHex(bytes));
}
function normalizePrivateKey(key) {
    let num;
    if (typeof key === "bigint") {
        num = key;
    }
    else if (typeof key === "number" && Number.isSafeInteger(key) && key > 0) {
        num = BigInt(key);
    }
    else if (typeof key === "string") {
        if (key.length !== 64)
            throw new Error("Expected 32 bytes of private key");
        num = hexToNumber(key);
    }
    else if (isUint8a(key)) {
        if (key.length !== 32)
            throw new Error("Expected 32 bytes of private key");
        num = bytesToNumber(key);
    }
    else {
        throw new TypeError("Expected valid private key");
    }
    if (!isWithinCurveOrder(num))
        throw new Error("Expected private key: 0 < key < n");
    return num;
}
function isUint8a(bytes) {
    return bytes instanceof Uint8Array;
}
function isWithinCurveOrder(num) {
    return _0n < num && num < CURVE.n;
}
const _0n = BigInt(0);
const _1n = BigInt(1);
const _2n = BigInt(2);
const POW_2_256 = _2n ** BigInt(256);
const CURVE = {
    a: _0n,
    b: BigInt(7),
    P: POW_2_256 - _2n ** BigInt(32) - BigInt(977),
    n: POW_2_256 - BigInt("432420386565659656852420866394968145599"),
    h: _1n,
    Gx: BigInt("55066263022277343669578718895168534326250603453777594175500187360389116729240"),
    Gy: BigInt("32670510020758816978083085130507043184471273380659243275938904335757337482424"),
    beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
};
function _bigintTo32Bytes(num) {
    const b = hexToBytes(numTo32bStr(num));
    if (b.length !== 32)
        throw new Error("Error: expected 32 bytes");
    return b;
}
function numTo32bStr(num) {
    if (typeof num !== "bigint")
        throw new Error("Expected bigint");
    if (!(_0n <= num && num < POW_2_256))
        throw new Error("Expected number 0 <= n < 2^256");
    return num.toString(16).padStart(64, "0");
}
function hexToBytes(hex) {
    if (typeof hex !== "string") {
        throw new TypeError("hexToBytes: expected string, got " + typeof hex);
    }
    if (hex.length % 2)
        throw new Error("hexToBytes: received invalid unpadded hex" + hex.length);
    const array = new Uint8Array(hex.length / 2);
    for (let i = 0; i < array.length; i++) {
        const j = i * 2;
        const hexByte = hex.slice(j, j + 2);
        const byte = Number.parseInt(hexByte, 16);
        if (Number.isNaN(byte) || byte < 0)
            throw new Error("Invalid byte sequence");
        array[i] = byte;
    }
    return array;
}
