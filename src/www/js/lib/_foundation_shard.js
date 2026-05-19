// Foundation Shard format - byte-exact port of backup-shard v0.3.0
// from foundation-api repo (tag 5.4.2, rev 8291859).
//
// The crate is at:
//   https://github.com/Foundation-Devices/foundation-api/tree/5.4.2/backup-shard
//
// Wire format is dCBOR (deterministic CBOR). The Shard struct is:
//   Shard {
//     shard: ShardVersion,    // CBOR map key 0
//     hmac: [u8; 32],         // CBOR map key 1
//   }
//   ShardVersion is encoded as CBOR array [version_u8, inner_map] where
//   inner_map is one of:
//     ShardV0 - keys 0..=4 (device_id, seed_fingerprint, seed_shamir_share,
//                           seed_shamir_share_index, part_of_magic_backup)
//     ShardV1 - keys 0..=7 (V0's fields + timestamp, scheme_threshold,
//                           scheme_share_count)
//
// Golden vectors (from foundation-api/backup-shard/tests/snapshots/) are
// asserted in the bundle's self-test below.

(function () {
  'use strict';

  // ----- dCBOR encoder (minimal) -------------------------------------------
  // Only the subset Foundation Shard needs: unsigned ints, byte strings,
  // booleans, arrays, maps. Maps are emitted in canonical key order
  // (length-then-lexicographic of encoded keys).

  function encodeUint(major, value) {
    // value must be >= 0
    if (typeof value === 'bigint') {
      if (value < 0n) throw new Error('Negative not supported');
      if (value <= 23n) return new Uint8Array([(major << 5) | Number(value)]);
      if (value <= 0xffn) return new Uint8Array([(major << 5) | 24, Number(value)]);
      if (value <= 0xffffn) {
        const v = Number(value);
        return new Uint8Array([(major << 5) | 25, (v >> 8) & 0xff, v & 0xff]);
      }
      if (value <= 0xffffffffn) {
        const out = new Uint8Array(5);
        out[0] = (major << 5) | 26;
        new DataView(out.buffer).setUint32(1, Number(value), false);
        return out;
      }
      // 64-bit
      const out = new Uint8Array(9);
      out[0] = (major << 5) | 27;
      const dv = new DataView(out.buffer);
      const hi = Number((value >> 32n) & 0xffffffffn);
      const lo = Number(value & 0xffffffffn);
      dv.setUint32(1, hi, false);
      dv.setUint32(5, lo, false);
      return out;
    }
    if (value < 0) throw new Error('Negative not supported');
    if (value <= 23) return new Uint8Array([(major << 5) | value]);
    if (value <= 0xff) return new Uint8Array([(major << 5) | 24, value]);
    if (value <= 0xffff) return new Uint8Array([(major << 5) | 25, (value >> 8) & 0xff, value & 0xff]);
    if (value <= 0xffffffff) {
      const out = new Uint8Array(5);
      out[0] = (major << 5) | 26;
      new DataView(out.buffer).setUint32(1, value, false);
      return out;
    }
    return encodeUint(major, BigInt(value));
  }

  function encodeInt(v) { return encodeUint(0, v); }
  function encodeBytes(bytes) {
    return concat(encodeUint(2, bytes.length), bytes);
  }
  function encodeBool(v) { return new Uint8Array([v ? 0xf5 : 0xf4]); }
  function encodeArray(items) {
    const parts = [encodeUint(4, items.length)];
    for (const item of items) parts.push(encode(item));
    return concat(...parts);
  }
  function encodeMap(entries) {
    // entries: [[key, value], ...]; we sort the encoded keys per dCBOR rules.
    const sorted = entries.slice().sort((a, b) => compareKeys(encode(a[0]), encode(b[0])));
    const parts = [encodeUint(5, sorted.length)];
    for (const [k, v] of sorted) { parts.push(encode(k)); parts.push(encode(v)); }
    return concat(...parts);
  }
  function compareKeys(a, b) {
    if (a.length !== b.length) return a.length - b.length;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  }
  function concat(...parts) {
    let total = 0; for (const p of parts) total += p.length;
    const out = new Uint8Array(total);
    let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  // Generic encode - dispatch based on JS type. Use sentinel wrappers when
  // the JS-type → CBOR-type mapping is ambiguous (e.g. you want a byte
  // string, not an integer-array).
  function encode(v) {
    if (v && v.__cborTag === 'bytes')   return encodeBytes(v.bytes);
    if (v && v.__cborTag === 'array')   return encodeArray(v.items);
    if (v && v.__cborTag === 'map')     return encodeMap(v.entries);
    if (v && v.__cborTag === 'uint')    return encodeUint(0, v.value);
    if (typeof v === 'boolean')         return encodeBool(v);
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return encodeInt(v);
    if (typeof v === 'bigint')          return encodeInt(v);
    if (v instanceof Uint8Array)        return encodeBytes(v);
    if (Array.isArray(v))               return encodeArray(v);
    throw new Error('Unsupported CBOR value: ' + JSON.stringify(v));
  }

  function bytes(u8) { return { __cborTag: 'bytes', bytes: u8 }; }
  function map(entries) { return { __cborTag: 'map', entries }; }
  function array(items) { return { __cborTag: 'array', items }; }

  // ----- dCBOR decoder (minimal) -------------------------------------------
  function decode(buf, offset) {
    offset = offset || 0;
    const ib = buf[offset];
    const major = ib >> 5;
    const arg = ib & 0x1f;
    let value, next = offset + 1;
    if (arg < 24) value = arg;
    else if (arg === 24) { value = buf[next]; next += 1; }
    else if (arg === 25) { value = (buf[next] << 8) | buf[next + 1]; next += 2; }
    else if (arg === 26) {
      value = (new DataView(buf.buffer, buf.byteOffset, buf.byteLength)).getUint32(next, false);
      next += 4;
    } else if (arg === 27) {
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const hi = dv.getUint32(next, false);
      const lo = dv.getUint32(next + 4, false);
      value = (BigInt(hi) << 32n) | BigInt(lo);
      next += 8;
    } else throw new Error('Invalid CBOR initial byte: ' + ib.toString(16));

    switch (major) {
      case 0: return [typeof value === 'bigint' && value <= Number.MAX_SAFE_INTEGER ? Number(value) : value, next];
      case 1: return [-1 - (typeof value === 'bigint' ? Number(value) : value), next];
      case 2: {
        const len = Number(value);
        const result = buf.slice(next, next + len);
        return [result, next + len];
      }
      case 4: {
        const arr = [];
        const len = Number(value);
        let off = next;
        for (let i = 0; i < len; i++) { const [v, n] = decode(buf, off); arr.push(v); off = n; }
        return [arr, off];
      }
      case 5: {
        const m = new Map();
        const len = Number(value);
        let off = next;
        for (let i = 0; i < len; i++) {
          const [k, n1] = decode(buf, off);
          const [v, n2] = decode(buf, n1);
          m.set(k, v);
          off = n2;
        }
        return [m, off];
      }
      case 7: {
        if (arg === 20) return [false, next];
        if (arg === 21) return [true, next];
        if (arg === 22) return [null, next];
        throw new Error('Unsupported simple value: ' + arg);
      }
      default: throw new Error('Unsupported CBOR major type: ' + major);
    }
  }

  // ----- Foundation Shard V0/V1 --------------------------------------------
  function encodeShardV0(s) {
    return encode(map([
      [0, bytes(s.deviceId)],
      [1, bytes(s.seedFingerprint)],
      [2, bytes(s.seedShamirShare)],
      [3, s.seedShamirShareIndex],
      [4, !!s.partOfMagicBackup],
    ]));
  }
  function encodeShardV1(s) {
    return encode(map([
      [0, bytes(s.deviceId)],
      [1, bytes(s.seedFingerprint)],
      [2, bytes(s.seedShamirShare)],
      [3, s.seedShamirShareIndex],
      [4, !!s.partOfMagicBackup],
      [5, s.timestamp || 0],
      [6, s.schemeThreshold],
      [7, s.schemeShareCount],
    ]));
  }
  function encodeShardVersionV0(s) {
    return encode(array([0, map([
      [0, bytes(s.deviceId)],
      [1, bytes(s.seedFingerprint)],
      [2, bytes(s.seedShamirShare)],
      [3, s.seedShamirShareIndex],
      [4, !!s.partOfMagicBackup],
    ])]));
  }
  function encodeShardVersionV1(s) {
    return encode(array([1, map([
      [0, bytes(s.deviceId)],
      [1, bytes(s.seedFingerprint)],
      [2, bytes(s.seedShamirShare)],
      [3, s.seedShamirShareIndex],
      [4, !!s.partOfMagicBackup],
      [5, s.timestamp || 0],
      [6, s.schemeThreshold],
      [7, s.schemeShareCount],
    ])]));
  }
  function encodeShard(s) {
    const ver = s.version === 1 ? array([1, map([
      [0, bytes(s.deviceId)],
      [1, bytes(s.seedFingerprint)],
      [2, bytes(s.seedShamirShare)],
      [3, s.seedShamirShareIndex],
      [4, !!s.partOfMagicBackup],
      [5, s.timestamp || 0],
      [6, s.schemeThreshold],
      [7, s.schemeShareCount],
    ])]) : array([0, map([
      [0, bytes(s.deviceId)],
      [1, bytes(s.seedFingerprint)],
      [2, bytes(s.seedShamirShare)],
      [3, s.seedShamirShareIndex],
      [4, !!s.partOfMagicBackup],
    ])]);
    return encode(map([
      [0, ver],
      [1, bytes(s.hmac || new Uint8Array(32))],
    ]));
  }

  function decodeShard(buf) {
    const [outer] = decode(buf, 0);
    if (!(outer instanceof Map)) throw new Error('Expected outer CBOR map');
    const verArr = outer.get(0);
    if (!Array.isArray(verArr) || verArr.length !== 2) throw new Error('Bad ShardVersion encoding');
    const version = verArr[0];
    const inner = verArr[1];
    if (!(inner instanceof Map)) throw new Error('Inner ShardVN must be a map');
    const hmacRaw = outer.get(1);
    if (!(hmacRaw instanceof Uint8Array) || hmacRaw.length !== 32) throw new Error('Bad hmac');
    const result = {
      version,
      deviceId:               inner.get(0),
      seedFingerprint:        inner.get(1),
      seedShamirShare:        inner.get(2),
      seedShamirShareIndex:   inner.get(3),
      partOfMagicBackup:      inner.get(4),
      hmac:                   hmacRaw,
    };
    if (version === 1) {
      result.timestamp        = inner.get(5);
      result.schemeThreshold  = inner.get(6);
      result.schemeShareCount = inner.get(7);
    }
    return result;
  }

  function toHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  function fromHex(hex) {
    if (typeof hex !== 'string') throw new Error('hex must be a string');
    const clean = hex.replace(/[\s\-_]+/g, '').toLowerCase();
    if (!/^[0-9a-f]+$/.test(clean)) throw new Error('Invalid hex');
    if (clean.length % 2) throw new Error('Hex length must be even');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
    return out;
  }

  // ----- Public surface ----------------------------------------------------
  const api = {
    encode:    (shard) => encodeShard(shard),
    encodeHex: (shard) => toHex(encodeShard(shard)),
    decode:    (buf) => decodeShard(buf),
    decodeHex: (hex) => decodeShard(fromHex(hex)),
    // Lower-level encoders (used by golden tests)
    encodeShardV0,
    encodeShardV1,
    encodeShardVersionV0,
    encodeShardVersionV1,
    // Util
    toHex,
    fromHex,

    // ===== Self-test: verify against golden vectors from foundation-api
    //       backup-shard/tests/snapshots/ at rev 8291859 (tag 5.4.2). If this
    //       throws, the encoding has drifted from upstream - bail loudly.
    selfTest() {
      const aa = new Uint8Array(32).fill(0xaa);
      const bb = new Uint8Array(32).fill(0xbb);
      const cc = new Uint8Array(32).fill(0xcc);
      const share = new Uint8Array([1, 2, 3, 4, 5]);

      const vectors = [
        // golden_backup_shard_v0
        {
          name: 'Shard V0',
          got: toHex(encodeShard({
            version: 0, deviceId: aa, seedFingerprint: bb, seedShamirShare: share,
            seedShamirShareIndex: 2, partOfMagicBackup: true, hmac: cc,
          })),
          want: 'a2008200a5005820aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa015820bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb02450102030405030204f5015820cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        },
        // golden_backup_shard_v1
        {
          name: 'Shard V1',
          got: toHex(encodeShard({
            version: 1, deviceId: aa, seedFingerprint: bb, seedShamirShare: share,
            seedShamirShareIndex: 2, partOfMagicBackup: true,
            timestamp: 1234567890, schemeThreshold: 3, schemeShareCount: 5,
            hmac: cc,
          })),
          want: 'a2008201a8005820aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa015820bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb02450102030405030204f5051a499602d206030705015820cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        },
        // golden_backup_shard_version_v0
        {
          name: 'ShardVersion V0',
          got: toHex(encodeShardVersionV0({
            deviceId: aa, seedFingerprint: bb, seedShamirShare: share,
            seedShamirShareIndex: 2, partOfMagicBackup: true,
          })),
          want: '8200a5005820aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa015820bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb02450102030405030204f5',
        },
        // golden_backup_shard_version_v1
        {
          name: 'ShardVersion V1',
          got: toHex(encodeShardVersionV1({
            deviceId: aa, seedFingerprint: bb, seedShamirShare: share,
            seedShamirShareIndex: 2, partOfMagicBackup: true,
            timestamp: 1234567890, schemeThreshold: 3, schemeShareCount: 5,
          })),
          want: '8201a8005820aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa015820bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb02450102030405030204f5051a499602d206030705',
        },
      ];

      const failures = vectors.filter((v) => v.got !== v.want);
      if (failures.length) {
        throw new Error('Foundation Shard golden test FAILED:\n' +
          failures.map((f) => `  ${f.name}:\n    got:  ${f.got}\n    want: ${f.want}`).join('\n'));
      }
      return { passed: vectors.length };
    },
  };

  if (typeof window !== 'undefined') window.foundationShard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
