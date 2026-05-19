# Seedtool - Testing Notes for New Tools

All nine tools below are reachable from the home grid at `dist/index.html`. Each has its own route (e.g. `#/miniscript`), an explainer panel that's dismissable, and a "← All tools" link back to the grid.

Every tool runs fully offline by default. The only place a network call happens is the optional **Resolve (online)** sub-tab in the BIP-353 helper, mirroring the existing BIP-47 "Use paynym.rs" opt-in. Other tools never reach out. The page itself gates on `window.crypto.subtle` and `navigator.clipboard`, which need a secure context (HTTPS or localhost, not plain-HTTP LAN access).

## What's new in the shell

Before getting to the per-tool tests, two general changes to verify:

- **Topbar consolidation.** Once a seed is loaded, the page title "Bitcoin Seed Tool" is replaced in the topbar by a compact pill: `●  <fingerprint>  ·  <truncated mnemonic>  Edit  Clear`. There's no longer a second sticky bar below the topbar. On widths under 560px the mnemonic preview hides so the fingerprint + actions stay visible.
- **Seed hero panel.** In the Seed Workspace, the OUTPUT section now starts with a hero panel: the mnemonic in numbered word cards (click any word to copy, brief green pulse confirms) and a "Your first Bitcoin address" panel with the BIP-84 `m/84'/0'/0'/0/0` address + QR code. A framing sentence above it adapts to word count: "These twelve words are your wallet..." When you change the BIP-39 passphrase, the fingerprint chip + address value + QR + the BIP32 Root Fingerprint field all flash blue briefly to signal the wallet derivation changed.
- **Entropy long-value truncation.** Raw Binary, Filtered Entropy, and Word Indexes panels clamp to ~3 lines with a "Show all" pill. Toggle persists per panel.

---

## 1. Sign & Verify Messages

**Route:** `#/message`

**What it does:** Proves you own an address by signing a message with the corresponding private key, or verifies someone else's signature. Implements BIP-137 (legacy / Segwit) and BIP-322 (full Bitcoin Script, the modern standard).

### How to test

1. Load a seed first via `#/seed`. The signer needs access to the private key.
2. Open `#/message`, pick **Sign**.
3. Pick a script type. Try all four: Legacy, Nested Segwit, Native Segwit, Taproot.
4. Enter a message like `Hello from Q`.
5. Click "Sign". You should get a base64 signature.
6. Copy address + message + signature, open the **Verify** tab, paste them in, and confirm.

### Edge cases to try

- Sign with one script type, verify with another. Should fail with a clear error.
- Empty message. Should still sign and verify.
- Verify with a tampered message (change one character). Should fail.
- Verify with a tampered signature. Should fail.
- A BIP-322 signature from an external wallet (Sparrow, Bitcoin Core). Should verify.

### Pass criteria

Sign → verify round trip works for all four script types. Tampered inputs are rejected with an obvious error.

---

## 2. Seed Phrase Recovery

**Route:** `#/recover`

**What it does:** Recovers a seed from partial information. Five modes:

- **Typos:** one or more BIP-39 words have a typo, the rest are correct.
- **Missing words:** you have most words but a few are blank.
- **Scrambled order:** all words are correct but out of order.
- **Hex / binary / indexes:** convert raw entropy or BIP-39 indexes back into a valid mnemonic.

### How to test

1. Take a known seed. Note its first address (xpub or first receive address).
2. Mangle it in each of the ways above and paste into the recovery tool with the constraint address.
3. The tool should iterate candidates and surface the original seed.

### Edge cases

- Two typos at once. Should still recover (slower).
- A "typo" that's actually a valid BIP-39 word. Should still iterate options.
- Constraint address with the wrong derivation path. Should fail clearly.
- Constraint address with a passphrase but you forget to enter it. Should fail clearly.
- Hex entropy of the wrong length (e.g. 30 bytes instead of 32). Should reject with a clear message.

### Pass criteria

Round trip works for each of the five modes. The address constraint prevents false positives from other valid mnemonics.

---

## 3. Silent Payments (BIP-352)

**Route:** `#/silent`

**What it does:** Generates a reusable static `sp1q…` address from your seed, decodes someone else's `sp1q…`, and demonstrates a send.

### Sub-tabs

- **Receive:** shows your scan + spend pubkeys and your `sp1q…` address, with QR.
- **Inspect:** paste any `sp1q…` (or `tsp1q…` testnet) to see the embedded scan/spend pubkeys.
- **Send:** pick a recipient address, generate a unique one-time on-chain address for them.
- **vs BIP-47:** comparison panel.
- **How it works:** plain-English walkthrough.

### How to test

1. Load a seed.
2. Receive tab: confirm an `sp1q…` address renders. Toggle Mainnet / Testnet. Confirm prefix changes.
3. Copy the address, open **Inspect**, paste it back. Decoded scan/spend pubkeys should match your Receive tab values.
4. Send tab: paste your own `sp1q…`, supply a sample input keypair, generate the one-time address. The address should be unique each time.

### Edge cases

- No seed loaded. Should show "Load a seed first" with a link.
- Invalid `sp1q…` in Inspect. Should reject with a clear message.
- Testnet address parsed on mainnet (or vice versa). Should still decode and label the network.

### Pass criteria

Address generation is deterministic across reloads. Decode round trip is consistent. Send produces a different one-time address on each invocation.

---

## 4. Shamir Sharing

**Route:** `#/shamir`

**What it does:** Splits a seed (or master secret) into shares using a Shamir Secret Sharing scheme, and reassembles shares back into the seed. Supports three standards:

- **SLIP-39** (Trezor): mnemonic words per share, multiple groups supported.
- **SSKR** (Blockchain Commons): bytewords or UR-encoded shares.
- **Foundation Shard** (Passport Prime): dCBOR encoding matching the on-device `backup-shard` crate.

### How to test

1. Load a seed.
2. Open the Split tab. Pick a standard, threshold, and total shares (e.g. 2-of-3 SLIP-39).
3. Generate shares. Save them somewhere.
4. Open the Recover tab. Paste back enough shares (any 2 of the 3). The original mnemonic should appear.
5. Repeat for each of the three standards.

### Foundation Shard specific

The Foundation Shard format mirrors KeyOS Magic Backups exactly. Validated against the golden test vectors from the `backup-shard` crate (foundation-api tag 5.4.2 rev 8291859), so any share produced here should be readable by Passport Prime and vice versa.

### Edge cases

- Threshold = total (n-of-n). Should require every share.
- Provide fewer than threshold shares. Should fail with "need k more shares".
- Mix shares from two different splits. Should fail.
- Split a 12-word seed and a 24-word seed. Both should round trip.
- SSKR: confirm both bytewords and UR encodings round trip.

### Pass criteria

Round trip works for all three standards across 12-word and 24-word seeds. Insufficient or mismatched shares are rejected.

---

## 5. BIP-329 Wallet Labels

**Route:** `#/labels`

**What it does:** Decodes a BIP-329 JSONL export (one JSON object per line) and displays the entries grouped by type: transactions, addresses, public keys, inputs, outputs, xpubs.

### How to test

Two input paths:

**File upload** (newer, primary path)
1. Click "Upload a .jsonl file" — the system file picker opens. Pick a `.jsonl` export from any compatible wallet.
2. The file contents land in the textarea, the filename + size appears next to the button, and the decode runs automatically.
3. The file never leaves the device. Verify in DevTools Network: no requests fire on upload.

**Paste**
1. Paste a JSONL block like:

   ```
   {"type":"tx","ref":"f91d0a8a78462bc59398f2c5d7a84fcff491c26ba54c4833478b202796c8aafd","label":"Funding"}
   {"type":"addr","ref":"bc1q34aq5drpuwy3wgl9lhup9892qp6svr8ldzyy7c","label":"Cold storage","spendable":true}
   {"type":"output","ref":"f91d0a8a78462bc59398f2c5d7a84fcff491c26ba54c4833478b202796c8aafd:1","label":"Reserved UTXO","spendable":false}
   {"type":"xpub","ref":"xpub6CSScQKB6QzExpRGoVcaCDqzvyEzom1WgtP3qbUKDsmKKsr3w4VcZXMpkdvCeAFkNNDt4XV9PEnQyRfsyJyJEQTQlx2bvbnnXgr3rE3rGcs","label":"Vault account","origin":"m/84h/0h/0h"}
   ```

2. Click Decode. You should see a stats line ("4 labels parsed") and one grouped table per type with a Reference column, Label column, and flag pills for spendable / frozen / origin.

### Edge cases

- Mix valid and invalid lines. The errors block should call out each bad line by number.
- Unknown `type` value. Should error for that line, accept the others.
- Empty `label` field. Should render an italic "empty - deletion marker" placeholder per the spec.
- A real wallet's export. Should parse without changes (try Sparrow → Settings → Export Labels).
- File > 25 MB. Should be rejected with a clear error in the file picker.

### Pass criteria

Parses any BIP-329 compliant JSONL. Reports parse errors per line without dropping the rest.

### Already verified

Spec test vectors from [BIP-329](https://github.com/bitcoin/bips/blob/master/bip-0329.mediawiki) round-trip cleanly: tx + addr + output + xpub all parsed, `origin` and `spendable` fields preserved.

---

## 6. Lightning Decoder

**Route:** `#/lightning`

**What it does:** Decodes Lightning invoices and offers into human-readable fields. Two sub-tabs:

- **BOLT-11 invoice:** the original one-shot `lnbc…` format.
- **BOLT-12 offer / invoice:** the modern reusable `lno…` / `lni…` / `lnr…` format.

No signature verification, no network calls. Same content you'd see on a Lightning block explorer.

### How to test BOLT-11

1. Paste a real `lnbc…` invoice (any one from a wallet, exchange, or test vector).
2. Click Decode. You should see Network, Amount (sats / BTC / msat), Created at, Expires, Description, Payment hash, Payment secret, Payee node ID, Route hints, Features, Signature.

### How to test BOLT-12

1. Paste an `lno1…` offer. Try one from bolt12.org examples or a real Lightning node's offer.
2. Click Decode. You should see kind (offer / invoice / invoice_request), Offer ID, HRP, Description, Issuer, blinded paths, raw TLV records.

### Edge cases

- Strip the `lightning:` prefix. Should still parse.
- Malformed checksum (change one character). Should error clearly.
- Expired invoice. Should still parse and display the "expired at" date so you can see when.
- Unknown TLV types. BOLT-12 may reject offers with non-standard TLVs; that's expected.

### Pass criteria

Parses real-world invoices and offers. Errors are descriptive, not silent.

### Already verified

- BOLT-11 spec test vector (`lnbc2500u…` "1 cup coffee") round-trips: 250,000 sats, description, payment hash, payment secret, timestamp, expiry all correct.
- BOLT-12 spec test vectors from [format-string-test.json](https://raw.githubusercontent.com/lightning/bolts/master/bolt12/format-string-test.json) decode identically across plain / `+`-chunked / whitespace-spanning encodings.

---

## 7. Miniscript Lab

**Route:** `#/miniscript`

**What it does:** Compiles Bitcoin spending policies into Miniscript and Bitcoin Script, parses full output descriptors, derives addresses, runs static safety analysis, enumerates every way the script can be spent, and translates timelocks into human time.

### Modes

- **Auto-detect** (default) → looks at the input and picks the right parser.
- **Policy** → high-level form. Compiles to Miniscript via the C++ reference compiler (sipa/miniscript).
- **Miniscript** → analyse directly. Accepts real 33-byte hex pubkeys (P2WSH) or 32-byte x-only (Tapscript).
- **Descriptor** → unwraps `wsh(...)`, `tr(...)`, `sh(wsh(...))`, etc. Handles BIP-389 multipath (`<0;1>/*` and `/**` shorthand), validates / recomputes the `#xxxxxxxx` checksum, and auto-detects network from xpub prefix (xpub → mainnet, tpub → testnet).

### Contexts

- **P2WSH** (Segwit v0): ECDSA, `multi(k,…)` for multisig.
- **Tapscript** (Taproot leaf): Schnorr, `multi_a(k,…)` for multisig.

### How to test

1. Try each of the seven prebuilt examples (buttons next to Compile):
   - **2-of-3 vault** (policy): `thresh(2,pk(A),pk(B),pk(C))` → compiles to `multi(2,A,B,C)`, 3 non-malleable spend paths (A+B, A+C, B+C).
   - **Timelock HODL** (policy): `and(pk(Owner),older(52560))` → one spend path with `older(52560)` annotated as "~1 year".
   - **Hot key + recovery** (policy): `or(99@pk(Hot),and(pk(Recovery),older(8640)))` → two paths.
   - **HTLC-like** (policy): `or(and(pk(Receiver),sha256(H)),and(pk(Sender),older(144)))`.
   - **Single key + recovery (1y)** (descriptor, real xpubs) → derives addresses, decodes `older(52560)` as "1 year".
   - **2-of-3 + cold recovery (6m)** (descriptor, real xpubs) → 4 spend paths, addresses on receive + change.
   - **Tiered recovery (3m / 1y)** (descriptor, real xpubs) → 3 paths, two distinct timelocks.
2. Paste your own descriptor (Liana, Nunchuk, Sparrow, Bitcoin Core — any BIP-380/389 descriptor). Auto-detect should pick it up. Verify:
   - Inner miniscript extracted.
   - Network correctly chosen (xpub → mainnet, tpub → testnet).
   - Descriptor checksum validated (or recomputed if absent).
   - First 10 receive + 10 change addresses derived, switchable to 5 / 20, switchable between mainnet / testnet / regtest.
   - Keys panel lists each cosigner: `@N`, `[fingerprint/path]`, and the truncated xpub.
3. Switch to Miniscript mode manually and paste a real hex-pubkey fragment. Bitcoin Script (hex) field should populate with raw bytes.
4. Switch to Tapscript context. Confirm `multi` rewrites to `multi_a`.

### What to verify in the output

- **Descriptor section** (only when input was a descriptor): the full descriptor with checksum, plus a Keys panel listing each `@N` placeholder with its `[fingerprint/path]` and xpub.
- **Compiled Miniscript:** the lower-level expression (with `@0`, `@1`, ... placeholders for descriptor keys).
- **Bitcoin Script (ASM):** human-readable opcodes.
- **Bitcoin Script (hex):** raw bytes — only populates when keys are real hex pubkeys (symbolic names like `A`, `B`, `@0` show an info note instead).
- **Derived addresses** (descriptor mode only, ranged descriptors): two columns of addresses (receive `/0/*` + change `/1/*` for multipath), 5 / 10 / 20 rows, switchable network.
- **Analysis:** seven flags. Green = safe, amber = warning, red = unsafe.
  - Sane at top level
  - Sane at every sub-level
  - Valid Miniscript
  - Non-malleable spend paths
  - Requires a signature
  - No timelock mixing
  - No duplicate keys
- **Spend paths:** every distinct way the script can be satisfied, with required signers, preimages, and **human-readable timelocks** per branch. Examples:
  - `older(144)` → "144 block confirmations (~1 day)"
  - `older(52560)` → "52,560 block confirmations (~1 year)"
  - `older(0x400000 | N)` → "~N×512 seconds (time-based)"
  - `after(840000)` → "block height 840,000"
  - `after(1714521600)` → "Wed May 01 2024 00:00:00 GMT (unix timestamp ...)"
- Each path shows its witness in ASM.

### Edge cases to try

- A policy that fails to compile (e.g. malformed parens). Should show "Policy did not compile" with the reference compiler's error.
- A Miniscript with mixed timelocks (absolute and relative in the same branch). Analysis should flag "Mixes absolute and relative timelocks".
- A Miniscript with duplicate keys (same key on multiple branches). Should flag "Duplicate keys present".
- An obviously malleable construction (e.g. `or_b` without proper wrappers). Should produce malleable paths and warn.
- A testnet `tpub` descriptor. Network should auto-detect; address panel should default to Testnet.
- BSMS-style descriptor with `/**` shorthand instead of explicit `<0;1>/*`. Should still parse and derive both receive + change.
- A descriptor with no `#checksum` suffix. Should accept it and recompute the checksum for display.
- A descriptor with the wrong `#checksum`. Should show "Invalid checksum" or a descriptor parse error.
- Non-ranged descriptor like `wsh(sortedmulti(1,[fp/path]pubkey1,[fp/path]pubkey2))`. Should derive a single address.

### Pass criteria

All seven examples compile and produce the expected spend paths. Real hex pubkeys produce real script hex. Pasting a real descriptor (from Liana, Nunchuk, Sparrow, Bitcoin Core, etc.) parses cleanly with the correct network auto-detected and addresses derived. Analysis flags match what you'd expect for each example.

### Already verified

- Real Liana testnet descriptor from the [BitBox + Liana blog post](https://blog.bitbox.swiss/en/exploring-bitcoin-miniscript-with-liana-and-the-bitbox02/) parses: testnet auto-detected, multipath addresses derived, `older(3)` annotated as "~30 minutes".
- Real Nunchuk mainnet descriptor (raw pubkeys, `sortedmulti`) from the [Nunchuk e2ee-multisig docs](https://github.com/nunchuk-io/docs/blob/main/e2ee-multisig.md) parses cleanly with a single P2WSH address derived.
- BSMS-style descriptor with `/**` shorthand parses and derives both receive + change.
- Cross-tested all three real-world wallet formats — no parsing bugs after the network auto-detect + `/**` regex fixes shipped earlier.

---

## 8. PSBT Inspector

**Route:** `#/psbt`

**What it does:** Parses a Partially Signed Bitcoin Transaction (BIP-174) in base64 or hex form and breaks it down into a forensic summary: every input and output, who has signed what, BIP-32 derivation paths, fee, and what's still required to finalise.

Read-only - never signs, never modifies. Useful before any signing ceremony to confirm what you are about to authorise.

### How to test

1. Grab a PSBT from anywhere. Examples:
   - Sparrow: Tools → Send → enter a destination → Create Transaction → "Sign" tab → copy PSBT.
   - Bitcoin Core: `walletcreatefundedpsbt` from RPC.
   - Hardware wallet workflow: any PSBT exported from Passport or Envoy.
   - The bundled samples in the BIP-174 test vectors at https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki#test-vectors.
2. Paste it into the textarea (the tool accepts base64 starting with `cHNidP8B…` or hex starting with `70736274ff…`).
3. Click Inspect.

### What to verify in the output

- **Status pill:** UNSIGNED / N SIGNED / N FINALISED / FULLY SIGNED, matching the PSBT's actual state.
- **Network:** mainnet / testnet / regtest detected from output addresses.
- **Tx version, locktime:** match the unsigned transaction header.
- **Total input value, total output value, fee:** fee should equal inputs minus outputs. If any input is missing `witnessUtxo` / `nonWitnessUtxo`, fee will display "need full UTXO data".
- **Est. fee rate:** sats per virtual byte, computed from a script-type-aware vbyte estimate. Rough - not exact since it doesn't know future witness sizes.

Per input:
- Outpoint (prev txid:vout), sequence (decimal + hex).
- Input script type, value, address.
- Pills: script type, signature status, sighash flag, "no UTXO data" if missing.
- Partial signatures: pubkey + signature (truncated, full visible on hover) + sighash flag name.
- BIP-32 derivations: master fingerprint, path, pubkey for each cosigner.
- Taproot derivations and key data when applicable.
- Redeem script / witness script when present (for P2SH and P2WSH).

Per output:
- Value, address, script type, script hex.
- "Likely change" pill when an output's derivation matches an input's master fingerprint.
- Taproot data when applicable.

Global xpubs section appears when the PSBT carries any (multisig coordinator-style PSBTs do).

### Edge cases to push

- A PSBT with no `witnessUtxo` for a Segwit input (incomplete). Fee should be marked unknown, "no UTXO data" pill shown.
- A 2-of-3 multisig PSBT with one partial signature. Should show 1 sig under that input, with the cosigner's fingerprint.
- A finalised PSBT (after running `finalizepsbt` in Core). Should show FULLY SIGNED.
- A Taproot key-spend PSBT. Should show `tapKeySig` and `tapInternalKey`.
- A Taproot script-path PSBT. Should show tap leaves and tap script sigs.
- A PSBT with non-standard `SIGHASH_ANYONECANPAY`. Sighash pill should reflect the exact flag.
- Hex input instead of base64. Should parse identically.
- Garbled input. Should error with a clear message saying it tried both base64 and hex.

### Pass criteria

Any PSBT that other tools (Sparrow, Bitcoin Core, hardware wallet companions) accept should parse. Fee, sigs, derivations, and addresses match what those tools report. Errors are descriptive.

### Already verified

[BIP-174 spec test vector](https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki#test-vectors) (2-of-2 P2SH-P2WSH, 1 partial signature) parses correctly: 1/2 signed, SIGHASH_ALL flag, both derivations with master fingerprint `b4a6ba67`, redeem + witness scripts present, fee 1,013 sats at ~6.80 sat/vB.

---

## 9. BIP-353 DNS Payment Helper

**Route:** `#/bip353`

**What it does:** Turns a memorable `name@domain` identifier into a Bitcoin payment endpoint via DNS TXT records. Three sub-tabs.

### Build a record (offline)

1. Enter a name + domain. Live preview shows the FQDN: `<name>.user._bitcoin-payment.<domain>`.
2. Fill at least one payment endpoint: Silent Payment (`sp1q…`), BOLT-12 offer (`lno1…`), or on-chain address.
3. Optional metadata: amount (BTC), label, message.
4. Click Build URI & record.
5. You should see:
   - **Bitcoin URI** — what a wallet will follow once it resolves your identifier.
   - **DNS TXT record name** — the FQDN you paste into your DNS provider's name field.
   - **DNS TXT record value** — the quoted URI to paste into the value field.

### Inspect a URI (offline)

1. Paste a `bitcoin:` URI (or a quoted TXT-record value — quotes get stripped).
2. The decoded fields appear, grouped by type: on-chain address, amount, label, message, Silent Payment, BOLT-12, BOLT-11, PayJoin, etc.
3. Cross-link buttons appear at the bottom if Silent Payment or Lightning endpoints are present — they jump to those tools for deeper analysis.

### Resolve (online, opt-in)

**This is the only place in the seedtool that makes a network call.** A clear yellow banner warns about this at the top of the sub-tab.

1. Enter a name + domain (e.g. `matt@mattcorallo.com` — the BIP-353 author's own published identifier, useful as a sanity check).
2. Pick a DoH resolver: Cloudflare or Google.
3. Click Resolve via DNS.
4. You should see:
   - **DNSSEC flag** — green if AD bit set (resolver validated DNSSEC), amber otherwise. BIP-353 requires DNSSEC; treat amber with caution.
   - **DNS response status** — NOERROR or an error code.
   - **Resolved TXT value** — the raw record.
   - **Decoded URI fields** — same rendering as the Inspect tab.

### Edge cases

- Non-existent name. Should show "No TXT record found" but keep DNSSEC + status flags visible.
- TXT record that doesn't start with `bitcoin:`. Should warn "doesn't begin with `bitcoin:` — probably not a BIP-353 record."
- Resolver returns 5xx or network error. Should surface the error clearly with "Are you offline?" hint.
- Build with no payment endpoints. Should error: "Provide at least one payment endpoint".
- Build with an invalid Silent Payment prefix (not `sp1q` / `tsp1q`). Should reject.
- Inspect a non-bitcoin URI like `https://...`. Should reject.

### Pass criteria

- Build → Inspect round trip is lossless: every field that goes in comes out.
- Resolve works against any DNSSEC-signed BIP-353 record online; refuses cleanly when offline.
- Other two sub-tabs work offline (no fetches in DevTools Network tab when on Build or Inspect).

### Already verified

- Build → Inspect round trip with Silent Payment + BOLT-12 + amount + label + message: all 5 fields preserved.
- Resolve against `matt@mattcorallo.com` via Cloudflare DoH: DNSSEC validated, fields decoded (on-chain address + BOLT-12 offer).
- Negative resolve (`nonexistent@example.com`) reports cleanly.

---

## General

- **No data leaves the page** — with one exception: the BIP-353 "Resolve (online)" sub-tab and the existing BIP-47 "Use paynym.rs" toggle. Both are opt-in and clearly labelled. Everything else stays offline. Open the Network tab in DevTools to confirm.
- **Refresh between tests.** State is in memory only; a reload clears everything.
- **Console errors.** Watch for any red errors in the browser console while exercising each tool. Pre-existing QR errors on the Silent Payments Receive tab when no seed is loaded are known noise and can be ignored.

If anything trips, capture the input, the error message, and the console output. That's enough to reproduce.
