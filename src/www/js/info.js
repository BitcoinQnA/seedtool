window.infoHtml = {
  usage: /*html*/ `
  <h3>Usage</h3>
  <p>
    This tool is awesome! Here's why:
  </p>
  <ul>
    <li>this reason</li>
    <li>this reason</li>
    <li>this reason</li>
    <li>this reason</li>
    <li>this reason</li>
    <li>this reason</li>
  </ul>
  `,
  BIP32: /*html*/ `
        <h3>BIP32: Hierarchical Deterministic Wallets</h3>
        <p>
          About BIP
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki" target="_blank">BITCOIN IMPROVEMENT PROPOSAL</a>
        </p>
        <h4>Entropy</h4>
        <p>
          <span>Entropy values should not include the BIP39 checksum. This is automatically added by the tool.</span>
        </p>
        <p>
          <span>
            Entropy values must be sourced from a
            <a href="https://en.wikipedia.org/wiki/Random_number_generation" target="_blank">strong source of
              randomness</a>.
          </span>
          <span>This means flipping a fair coin, rolling a fair dice, noise measurements etc.</span>
          <span>
            Do <strong>NOT</strong> use phrases from books, lyrics from songs, your birthday or street address,
            keyboard mashing, or anything you <i>think</i> is random, because chances are overwhelming it isn't
            random enough for the needs of this tool.
          </span>
        </p>
        <p>
          <strong><span>Do not store entropy.</span></strong>
        </p>
        <p>
          <span>Storing entropy (such as keeping a deck of cards in a specific shuffled order) is unreliable compared to
            storing a mnemonic.</span>
          <span>Instead of storing entropy, store the mnemonic generated from the entropy.</span>
          <span><a href="https://en.wikipedia.org/wiki/Steganography#Physical" target="_blank">Steganography</a> may be
            beneficial when storing the mnemonic.</span>
        </p>
        <p>
          <span>
            The random mnemonic generator on this page uses a
            <a href="https://developer.mozilla.org/en-US/docs/Web/API/RandomSource/getRandomValues"
              target="_blank">cryptographically secure random number generator</a>.
          </span>
          <span>The built in random generator can generally be trusted more than your own intuition about
            randomness.</span>
          <span>If cryptographic randomness isn't available in your browser, this page will show a warning and the
            generate
            button will not work.</span>
          <span>In that case you might choose to use your own source of entropy.</span>
        </p>
        <p>
          <a href="https://bitcointalk.org/index.php?topic=311000.msg3345309#msg3345309" target="_blank">You are not a
            good
            source of entropy.</a>
        </p>
        <p>
          <span>Card entropy has been implemented assuming cards are replaced, not drawn one after another.</span>
          <span>A full deck with replacement generates 232 bits of entropy (21 words). A full deck without replacement
            generates 225 bits of entropy (21 words).</span>
          <span>Card entropy changed significantly from v0.4.3 to v0.5.0. The old version can be accessed at
            <a href="https://github.com/iancoleman/bip39/releases/tag/0.4.3">
              here
            </a>
            or
            <a href="https://web.archive.org/web/20201018232020/https://iancoleman.io/bip39/">
              here
            </a>
          </span>
        </p>`,
  BIP39: /*html*/ `
        <h3>BIP39: Mnemonic code for generating deterministic keys</h3>
        <p>
          Test
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki" target="_blank">BITCOIN IMPROVEMENT PROPOSAL</a>
        </p>`,
  BIP44: /*html*/ `
        <h3>BIP44: Multi-Account Hierarchy for Deterministic Wallets</h3>
        <p>
          About BIP
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki" target="_blank">BITCOIN IMPROVEMENT PROPOSAL</a>
        </p>`,
  BIP47: /*html*/ `
        <h3>BIP47: Reusable Payment Codes for Hierarchical Deterministic Wallets</h3>
        <p>
          About BIP
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0047.mediawiki" target="_blank">BITCOIN IMPROVEMENT PROPOSAL</a>
        </p>`,
  BIP49: /*html*/ `
        <h3>BIP49: Derivation scheme for P2WPKH-nested-in-P2SH based accounts</h3>
        <p>
          About BIP
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki" target="_blank">BITCOIN IMPROVEMENT PROPOSAL</a>
        </p>`,
  BIP84: /*html*/ `
        <h3>BIP84: Derivation scheme for P2WPKH based accounts</h3>
        <p>
          About BIP
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki" target="_blank">BITCOIN IMPROVEMENT PROPOSAL</a>
        </p>`,
  BIP85: /*html*/ `
        <h3>BIP85: Deterministic Entropy From BIP32 Keychains</h3>
        <p>
          About BIP
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0085.mediawiki" target="_blank">BITCOIN IMPROVEMENT PROPOSAL</a>
        </p>`,
  BIP141: /*html*/ `
        <h3>BIP141: Segregated Witness (Consensus layer)</h3>
        <p>
          About BIP
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki" target="_blank">BITCOIN IMPROVEMENT PROPOSAL</a>
        </p>`,
  ADDRESSES: /*html*/ `
        <h3>Derived Addresses</h3>
        <p>
          About Derived Addresses
        </p>`,
  CREDITS: /*html*/ `
        <h3>Credits and licenses</h3>
        <h4>Ian Coleman</h4>
        <p>
          The MIT License (MIT)
          Copyright (c) 2014-2016 Ian Coleman
        </p>
        <p>
          Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
        </p>
        <p>
          The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
        </p>
        <p>
          THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
        </p>`,
  UNKNOWN: /*html*/ `
        <h3>ERROR: 404</h3>
        <p>
          Sorry, No more information on that topic found.
        </p>`,
};
