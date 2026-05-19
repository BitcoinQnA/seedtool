// PSBT Inspector entry - parses a base64/hex PSBT and returns a flat structured
// summary suitable for display. Exposed as `window.psbtInspect`.

const bitcoin = require('bitcoinjs-lib');

const SIGHASH = {
  0:   'SIGHASH_DEFAULT (taproot)',
  1:   'SIGHASH_ALL',
  2:   'SIGHASH_NONE',
  3:   'SIGHASH_SINGLE',
  129: 'SIGHASH_ALL | ANYONECANPAY',
  130: 'SIGHASH_NONE | ANYONECANPAY',
  131: 'SIGHASH_SINGLE | ANYONECANPAY',
};

function hex(buf) {
  if (!buf) return null;
  const u = buf instanceof Uint8Array ? buf : Buffer.from(buf);
  return Buffer.from(u).toString('hex');
}

function reverseHex(h) {
  return h.match(/.{2}/g).reverse().join('');
}

function classifyScript(scriptHex) {
  if (!scriptHex) return 'unknown';
  const s = scriptHex.toLowerCase();
  if (/^76a914[0-9a-f]{40}88ac$/.test(s)) return 'p2pkh (legacy)';
  if (/^a914[0-9a-f]{40}87$/.test(s)) return 'p2sh';
  if (/^0014[0-9a-f]{40}$/.test(s)) return 'p2wpkh (native segwit)';
  if (/^0020[0-9a-f]{64}$/.test(s)) return 'p2wsh (native segwit multisig/script)';
  if (/^5120[0-9a-f]{64}$/.test(s)) return 'p2tr (taproot)';
  if (/^6a/.test(s)) return 'op_return';
  return 'non-standard';
}

function detectNetwork(addresses) {
  for (const a of addresses) {
    if (!a) continue;
    if (a.startsWith('bc1') || a.startsWith('1') || a.startsWith('3')) return 'mainnet';
    if (a.startsWith('tb1') || a.startsWith('m') || a.startsWith('n') || a.startsWith('2')) return 'testnet';
    if (a.startsWith('bcrt')) return 'regtest';
  }
  return 'unknown';
}

function tryAddress(script, networks) {
  for (const [name, net] of networks) {
    try { return { address: bitcoin.address.fromOutputScript(script, net), network: name }; }
    catch (_) { /* try next */ }
  }
  return { address: null, network: null };
}

function pickUtxoValue(inputData, txIn) {
  if (inputData.witnessUtxo) return { value: BigInt(inputData.witnessUtxo.value), script: inputData.witnessUtxo.script };
  if (inputData.nonWitnessUtxo) {
    try {
      const tx = bitcoin.Transaction.fromBuffer(Buffer.from(inputData.nonWitnessUtxo));
      const out = tx.outs[txIn.index];
      if (out) return { value: BigInt(out.value), script: out.script };
    } catch (_) {}
  }
  return { value: null, script: null };
}

function summariseDerivations(arr) {
  if (!arr || !arr.length) return [];
  return arr.map((d) => ({
    pubkey: hex(d.pubkey),
    masterFingerprint: hex(d.masterFingerprint),
    path: d.path,
  }));
}

function summarisePartialSigs(arr) {
  if (!arr || !arr.length) return [];
  return arr.map((s) => {
    const sigHex = hex(s.signature);
    const sighashByte = sigHex.length >= 2 ? parseInt(sigHex.slice(-2), 16) : null;
    return {
      pubkey: hex(s.pubkey),
      signature: sigHex,
      sighashFlag: sighashByte,
      sighashName: SIGHASH[sighashByte] || (sighashByte != null ? `0x${sighashByte.toString(16).padStart(2, '0')}` : null),
    };
  });
}

function inputFinalized(d) {
  return !!(d.finalScriptSig || (d.finalScriptWitness && d.finalScriptWitness.length));
}

function inputHasAnySignature(d) {
  if (inputFinalized(d)) return true;
  if (d.partialSig && d.partialSig.length) return true;
  if (d.tapKeySig) return true;
  if (d.tapScriptSig && d.tapScriptSig.length) return true;
  return false;
}

function inspect(input) {
  if (typeof input !== 'string') throw new Error('PSBT input must be a string');
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Empty input');

  let psbt;
  const errors = [];
  try {
    // Try base64 first
    psbt = bitcoin.Psbt.fromBase64(trimmed);
  } catch (e1) {
    errors.push('base64: ' + e1.message);
    try {
      psbt = bitcoin.Psbt.fromHex(trimmed);
    } catch (e2) {
      errors.push('hex: ' + e2.message);
      throw new Error('Not a valid PSBT (tried base64 and hex). ' + errors.join('; '));
    }
  }

  const networks = [
    ['mainnet', bitcoin.networks.bitcoin],
    ['testnet', bitcoin.networks.testnet],
    ['regtest', bitcoin.networks.regtest],
  ];

  const inputs = [];
  let totalInputValue = 0n;
  let allInputValuesKnown = true;
  let signedCount = 0;
  let finalizedCount = 0;

  for (let i = 0; i < psbt.inputCount; i++) {
    const txIn = psbt.txInputs[i];
    const d = psbt.data.inputs[i];
    const { value, script } = pickUtxoValue(d, txIn);
    let address = null;
    let scriptHex = hex(script);
    let scriptType = 'unknown';
    if (script) {
      scriptType = classifyScript(scriptHex);
      const addr = tryAddress(script, networks);
      address = addr.address;
    }
    if (value === null) allInputValuesKnown = false;
    if (value !== null) totalInputValue += value;

    const finalized = inputFinalized(d);
    const signed = inputHasAnySignature(d);
    if (signed) signedCount++;
    if (finalized) finalizedCount++;

    let inputType = scriptType;
    try { inputType = psbt.getInputType(i); } catch (_) {}

    const sighashType = typeof d.sighashType === 'number' ? d.sighashType : null;

    inputs.push({
      index: i,
      prevTxid: reverseHex(hex(txIn.hash)),
      prevVout: txIn.index,
      sequence: txIn.sequence,
      sequenceHex: txIn.sequence.toString(16).padStart(8, '0'),
      inputType,
      scriptType,
      scriptHex,
      value,
      valueKnown: value !== null,
      address,
      finalized,
      signed,
      partialSigs: summarisePartialSigs(d.partialSig),
      derivations: summariseDerivations(d.bip32Derivation),
      tapDerivations: summariseDerivations(d.tapBip32Derivation),
      tapInternalKey: hex(d.tapInternalKey),
      tapKeySig: hex(d.tapKeySig),
      tapScriptSigs: (d.tapScriptSig || []).map((s) => ({ pubkey: hex(s.pubkey), leafHash: hex(s.leafHash), signature: hex(s.signature) })),
      tapLeafScripts: (d.tapLeafScript || []).map((s) => ({ script: hex(s.script), version: s.leafVersion })),
      redeemScript: hex(d.redeemScript),
      witnessScript: hex(d.witnessScript),
      sighashType,
      sighashName: sighashType != null ? (SIGHASH[sighashType] || `0x${sighashType.toString(16).padStart(2, '0')}`) : null,
      witnessUtxoPresent: !!d.witnessUtxo,
      nonWitnessUtxoPresent: !!d.nonWitnessUtxo,
    });
  }

  const outputs = [];
  let totalOutputValue = 0n;
  const allAddresses = [];
  const ourFingerprints = new Set();
  for (const inp of inputs) for (const d of inp.derivations) if (d.masterFingerprint) ourFingerprints.add(d.masterFingerprint);

  for (let i = 0; i < psbt.txOutputs.length; i++) {
    const out = psbt.txOutputs[i];
    const value = BigInt(out.value);
    totalOutputValue += value;
    const scriptHex = hex(out.script);
    const scriptType = classifyScript(scriptHex);
    const addr = tryAddress(out.script, networks);
    allAddresses.push(addr.address);
    const od = psbt.data.outputs[i] || {};
    const derivations = summariseDerivations(od.bip32Derivation);
    const tapDerivations = summariseDerivations(od.tapBip32Derivation);
    const likelyChange = [...derivations, ...tapDerivations].some((d) => d.masterFingerprint && ourFingerprints.has(d.masterFingerprint));
    outputs.push({
      index: i,
      value,
      scriptHex,
      scriptType,
      address: addr.address,
      addressNetwork: addr.network,
      derivations,
      tapDerivations,
      likelyChange,
      redeemScript: hex(od.redeemScript),
      witnessScript: hex(od.witnessScript),
      tapInternalKey: hex(od.tapInternalKey),
    });
  }

  // Compute fee and rate manually since psbt.getFee() requires finalization
  let fee = null;
  let feeRate = null; // sats per vbyte estimate from tx weight
  if (allInputValuesKnown) {
    fee = totalInputValue - totalOutputValue;
    // Build an estimate of tx weight from the unsigned tx + per-input witness budget
    try {
      const tx = psbt.__CACHE.__TX || psbt.unsignedTx || null;
      // Fallback: use the toBuffer of just the unsigned tx - but bitcoinjs doesn't expose this directly.
      // We can approximate: base size = strippedLen of getUnsignedTx via cloning. Simpler: use 110 v-bytes per input rough estimate per common input type.
      const estimatedVbytes = estimateVbytes(inputs, outputs);
      if (estimatedVbytes > 0) feeRate = Number(fee) / estimatedVbytes;
    } catch (_) {}
  }

  // Global xpubs (PSBT_GLOBAL_XPUB)
  const globalMap = psbt.data.globalMap || {};
  const globalXpubs = (globalMap.globalXpub || []).map((g) => ({
    extendedPubkey: hex(g.extendedPubkey),
    masterFingerprint: hex(g.masterFingerprint),
    path: g.path,
  }));

  return {
    psbtVersion: 0,
    txVersion: psbt.version,
    locktime: psbt.locktime,
    inputCount: psbt.inputCount,
    outputCount: psbt.txOutputs.length,
    network: detectNetwork([...allAddresses, ...inputs.map((i) => i.address)]),
    totalInputValue,
    totalOutputValue,
    allInputValuesKnown,
    fee,
    feeRate,
    estimatedVbytes: feeRate ? Math.round(Number(fee) / feeRate) : null,
    signedCount,
    finalizedCount,
    fullySigned: finalizedCount === psbt.inputCount,
    unsignedCount: psbt.inputCount - signedCount,
    inputs,
    outputs,
    globalXpubs,
    rawSize: trimmed.length,
  };
}

// Rough vbyte estimate for fee-rate. Conservative.
function estimateVbytes(inputs, outputs) {
  let vb = 10; // version (4) + locktime (4) + marker/flag/segwit overhead ≈ 2 vbytes
  // Output vbytes: ~31 for p2wpkh, ~43 for p2wsh, ~43 for p2tr, ~34 for p2pkh, ~32 for p2sh
  for (const o of outputs) {
    if (o.scriptType.startsWith('p2wpkh')) vb += 31;
    else if (o.scriptType.startsWith('p2wsh')) vb += 43;
    else if (o.scriptType.startsWith('p2tr')) vb += 43;
    else if (o.scriptType.startsWith('p2pkh')) vb += 34;
    else if (o.scriptType.startsWith('p2sh')) vb += 32;
    else vb += 32;
  }
  // Inputs: p2wpkh ~68 vbytes, p2tr key-spend ~57, p2wsh multisig ~104+ (depends on m/n), p2pkh ~148
  for (const i of inputs) {
    const t = (i.inputType || i.scriptType || '').toLowerCase();
    if (t.includes('witnesspubkeyhash') || t.includes('p2wpkh')) vb += 68;
    else if (t.includes('taproot') || t.includes('p2tr')) vb += 57;
    else if (t.includes('p2wsh') || t.includes('witnessscripthash')) vb += 105;
    else if (t.includes('p2pkh') || t.includes('pubkeyhash')) vb += 148;
    else if (t.includes('p2sh') || t.includes('scripthash')) vb += 92;
    else vb += 100;
  }
  return vb;
}

const api = { inspect };
if (typeof window !== 'undefined') window.psbtInspect = api;
module.exports = api;
