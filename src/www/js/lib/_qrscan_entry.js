// Entry bundled with esbuild into js/lib/qrscan.js by build_qrscan.js.
// Decodes QR codes from camera frames or images (jsQR) and reassembles
// animated UR codes (BC-UR, such as ur:psbt and ur:crypto-psbt). Exposes a
// global `qrScan`. Everything runs locally; nothing is sent anywhere.

const jsQRModule = require('jsqr');
const { URDecoder } = require('@ngraveio/bc-ur');

const jsQR = jsQRModule.default || jsQRModule;

// Decode one frame. `image` is ImageData-like: { data, width, height }.
// Returns null when no QR code is found.
function decode(image) {
  const result = jsQR(image.data, image.width, image.height, {
    inversionAttempts: 'attemptBoth',
  });
  if (!result) return null;
  return { text: result.data, bytes: Uint8Array.from(result.binaryData) };
}

// Collects the frames of an animated UR code. Frames can arrive in any
// order and repeat: the fountain code rebuilds the payload once enough
// different frames have been seen. A single-frame UR completes at once.
function createUrCollector() {
  let decoder = new URDecoder();
  const progress = () =>
    typeof decoder.estimatedPercentComplete === 'function'
      ? Math.min(1, Math.max(0, decoder.estimatedPercentComplete()))
      : 0;
  return {
    // Returns { done, progress (0 to 1), type, bytes } or { error }
    receive(text) {
      const part = String(text).trim().toLowerCase();
      if (!part.startsWith('ur:')) return { error: 'This QR code is not part of a UR code.' };
      try {
        decoder.receivePart(part);
      } catch (e) {
        return { error: `This UR frame could not be read: ${e.message}` };
      }
      if (!decoder.isComplete()) return { done: false, progress: progress() };
      if (!decoder.isSuccess()) {
        const error = decoder.resultError();
        decoder = new URDecoder();
        return { error: `The UR code could not be put back together: ${error}` };
      }
      const ur = decoder.resultUR();
      return { done: true, progress: 1, type: ur.type, bytes: Uint8Array.from(ur.decodeCBOR()) };
    },
    reset() {
      decoder = new URDecoder();
    },
  };
}

// The UR types that carry a PSBT: `psbt` in the current registry and
// `crypto-psbt` in the older one that many wallets still use
const PSBT_UR_TYPES = ['psbt', 'crypto-psbt'];

module.exports = { decode, createUrCollector, PSBT_UR_TYPES };
