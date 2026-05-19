// Decoders bundle: BIP-329 wallet labels + BOLT-11 invoices + BOLT-12 offers.
// Bundled via esbuild into js/lib/decoders.js, exposed as window.decoders.

const bolt11Lib = require('light-bolt11-decoder');
const bolt12Lib = require('bolt12-utils');

// =============================================================================
// BIP-329 - Wallet Labels (JSONL)
// Spec: https://github.com/bitcoin/bips/blob/master/bip-0329.mediawiki
//
// Each line is a JSON object with shape:
//   { "type": "<tx|addr|pubkey|input|output|xpub>",
//     "ref":  "<reference: txid, address, hex, txid:vout, etc.>",
//     "label": "<UTF-8 human-readable string>",
//     "origin": "<optional: BIP-32 origin info>",
//     "spendable": <optional bool, for outputs and addrs> }
// =============================================================================

const BIP329_TYPES = ['tx', 'addr', 'pubkey', 'input', 'output', 'xpub'];

function parseBip329(text) {
  if (typeof text !== 'string') throw new Error('Input must be a string');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error('No JSONL lines found.');

  const entries = [];
  const errors = [];

  lines.forEach((line, idx) => {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (e) {
      errors.push({ lineIndex: idx + 1, lineSnippet: line.slice(0, 60), message: 'Invalid JSON: ' + e.message });
      return;
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      errors.push({ lineIndex: idx + 1, lineSnippet: line.slice(0, 60), message: 'Not a JSON object' });
      return;
    }
    const { type, ref, label, origin, spendable } = obj;
    if (typeof type !== 'string' || !BIP329_TYPES.includes(type)) {
      errors.push({ lineIndex: idx + 1, lineSnippet: line.slice(0, 60), message: `Unknown type "${type}". Valid: ${BIP329_TYPES.join(', ')}` });
      return;
    }
    if (typeof ref !== 'string' || !ref) {
      errors.push({ lineIndex: idx + 1, lineSnippet: line.slice(0, 60), message: 'Missing or empty "ref"' });
      return;
    }
    // label can be empty string (deletion semantic) per spec.
    entries.push({
      lineIndex: idx + 1,
      type, ref,
      label: typeof label === 'string' ? label : '',
      origin: typeof origin === 'string' ? origin : undefined,
      spendable: typeof spendable === 'boolean' ? spendable : undefined,
      extras: Object.fromEntries(
        Object.entries(obj).filter(([k]) => !['type', 'ref', 'label', 'origin', 'spendable'].includes(k))
      ),
    });
  });

  // Group by type for display
  const groups = {};
  BIP329_TYPES.forEach((t) => { groups[t] = []; });
  for (const e of entries) groups[e.type].push(e);

  return {
    entries,
    groups,
    errors,
    stats: {
      total: entries.length,
      errors: errors.length,
      byType: Object.fromEntries(BIP329_TYPES.map((t) => [t, groups[t].length])),
    },
  };
}

// =============================================================================
// BOLT-11 - Lightning Invoice
// =============================================================================
function decodeBolt11(invoice) {
  if (typeof invoice !== 'string') throw new Error('Invoice must be a string');
  const cleaned = invoice.trim().toLowerCase().replace(/^lightning:/, '');
  const result = bolt11Lib.decode(cleaned);
  // Normalise: result.sections is an array of tagged items. Flatten into a friendlier object.
  const out = {
    network: result.network && result.network.name,
    paymentRequest: result.paymentRequest,
    millisatoshis: null,
    amountSats: null,
    amountBtc: null,
    timestamp: null,
    timestampDate: null,
    expirySeconds: null,
    expiryDate: null,
    description: null,
    descriptionHash: null,
    paymentHash: null,
    paymentSecret: null,
    payeeNodeId: null,
    minFinalCltvExpiry: null,
    fallbackAddress: null,
    routeHints: [],
    features: null,
    metadata: null,
    rawSections: result.sections,
  };

  const sectionMap = {};
  for (const sec of result.sections || []) {
    sectionMap[sec.name] = sec.value;
  }

  if (sectionMap.amount) {
    const msats = BigInt(sectionMap.amount);
    out.millisatoshis = sectionMap.amount;
    const sats = Number(msats / 1000n);
    out.amountSats = sats;
    out.amountBtc = (Number(msats) / 100_000_000_000).toFixed(8);
  }
  if (sectionMap.timestamp !== undefined) {
    out.timestamp = sectionMap.timestamp;
    out.timestampDate = new Date(sectionMap.timestamp * 1000).toISOString();
  }
  if (sectionMap.expiry !== undefined) {
    out.expirySeconds = sectionMap.expiry;
    if (sectionMap.timestamp !== undefined) {
      out.expiryDate = new Date((sectionMap.timestamp + sectionMap.expiry) * 1000).toISOString();
    }
  }
  if (sectionMap.description !== undefined) out.description = sectionMap.description;
  if (sectionMap.description_hash) out.descriptionHash = sectionMap.description_hash;
  if (sectionMap.payment_hash) out.paymentHash = sectionMap.payment_hash;
  if (sectionMap.payment_secret) out.paymentSecret = sectionMap.payment_secret;
  if (sectionMap.payee) out.payeeNodeId = sectionMap.payee;
  if (sectionMap.min_final_cltv_expiry !== undefined) out.minFinalCltvExpiry = sectionMap.min_final_cltv_expiry;
  if (sectionMap.fallback_address) out.fallbackAddress = sectionMap.fallback_address;
  if (sectionMap.route_hints) out.routeHints = sectionMap.route_hints;
  if (sectionMap.feature_bits) out.features = sectionMap.feature_bits;
  if (sectionMap.metadata) out.metadata = sectionMap.metadata;
  if (sectionMap.signature) out.signature = sectionMap.signature;

  return out;
}

// =============================================================================
// BOLT-12 - Offers / Invoices / Invoice-Requests
// =============================================================================
function decodeBolt12(s) {
  if (typeof s !== 'string') throw new Error('Input must be a string');
  const cleaned = s.trim().toLowerCase().replace(/^lightning:/, '');
  // Determine the type from the HRP
  const lower = cleaned.replace(/[+\s]/g, '');
  let kind, fields;
  if (lower.startsWith('lno1')) {
    kind = 'offer';
    fields = bolt12Lib.decodeOffer(cleaned);
  } else if (lower.startsWith('lni1')) {
    kind = 'invoice';
    // bolt12-utils exposes extractInvoiceFields for parsing full invoice TLVs
    const { hrp, data } = bolt12Lib.decodeBolt12(cleaned);
    fields = bolt12Lib.extractInvoiceFields(data);
    fields.hrp = hrp;
  } else if (lower.startsWith('lnr1')) {
    kind = 'invoice_request';
    const { hrp, data } = bolt12Lib.decodeBolt12(cleaned);
    fields = bolt12Lib.extractInvoiceRequestFields(data);
    fields.hrp = hrp;
  } else {
    throw new Error('Unknown BOLT-12 prefix. Expected "lno1…" (offer), "lni1…" (invoice), or "lnr1…" (invoice request).');
  }
  return { kind, fields };
}

// =============================================================================
// Public surface
// =============================================================================
const api = {
  bip329: { parse: parseBip329, TYPES: BIP329_TYPES },
  bolt11: { decode: decodeBolt11 },
  bolt12: { decode: decodeBolt12 },
};
if (typeof window !== 'undefined') window.decoders = api;
module.exports = api;
