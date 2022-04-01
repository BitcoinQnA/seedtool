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
          BIP39 defines a standard for generating a human readable 'Mnemonic Code' (also known as your 'Seed Words') from the generated raw binary. Seed words
          are much easier for humans to manage than the long string of letters and numbers defined in BIP32. Due to the simplified nature of Mnemonics, BIP39 has
          seen universal adoption across 99% of the Bitcoin wallet ecosystem. Want to move your funds from one wallet to another? Just enter your seed words 
          (and passphrase if applicable) to the new wallet software. Below demonstrates the difference in readability between a root key and a BIP39 Mnemonic.   
          
          <h4>Here is an example of a BIP32 root key :-</h4> <pre>xprv9s21ZrQH143K2zHHcPMaoE4yw75u2TErFbGjLNuGfFrjnJCA9XuqXwsE8eitS3yp9XPhB3s2EdA4yWCkez2oXp249tBLBsKA7sDS9bhfMoQ</pre> 
          
          <h4>Here is the BIP39 Mnemonic of the same key:-</h4> <pre>pass hidden viable analyst disagree secret web cruise dumb offer dune reveal</pre><br/>   
              
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki" target="_blank">BIP39 page </a>
        </p>`,
  BIP44: /*html*/ `
        <h3>BIP44: Multi-Account Hierarchy for Deterministic Wallets</h3>
        <p>
          About BIP
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki" target="_blank">BIP44 page</a>
        </p>`,
  BIP47: /*html*/ `
        <h3>BIP47: Reusable Payment Codes for Hierarchical Deterministic Wallets</h3>
        <p>
          About BIP
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0047.mediawiki" target="_blank">BIP47 page</a>
        </p>`,
  BIP49: /*html*/ `
        <h3>BIP49: Derivation scheme for P2WPKH-nested-in-P2SH based accounts</h3>
        <p>
        BIP49 defines the standard for deriving P2SH-P2WPKH addresses, typically referred to as 'Wrapped Segwit' addresses. This BIP
        was introduced as a compatability fix to enable older wallets to send to wallets conforming to newer standards. Wrapped Segwit addresses beginning
        with <b>'3'</b> save on transaction fees when compared to older legacy types. This saving, although not those gained by wallets adopting
        Native Segwit, is achieve via an optimised transaction structure. <br/><br/>
        BIP49 also defines that wallets adopting the standard should adopt the <b>'ypub'</b> or <b>'yprv'</b> prefixes when displaying extended public/private keys.
        Wrapped Segwit addresses defined in this BIP are quickly being replaced in wallet software by those confirming to the BIP84 standard.
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki" target="_blank">BIP49 page</a>
        </p>`,
  BIP84: /*html*/ `
        <h3>BIP84: Derivation scheme for P2WPKH based accounts</h3>
        <p>
          BIP84 defines the standard for deriving P2WPKH addresses, typically referred to as 'Native Segwit' addresses.
          Segwit addresses beginning with <b>'bc1q'</b> are the most commonly used address type for modern bitcoin wallets. This is due to their ability to construct
          smaller transactions that save the user fees when spending. 

          BIP84 also defines that wallets adopting the standard should adopt the <b>'zpub'</b> or <b>'zprv'</b> prefixes when displaying extended public/private keys.
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki" target="_blank">BIP84 page</a>
        </p>`,
  BIP85: /*html*/ `
        <h3>BIP85: Deterministic Entropy From BIP32 Keychains</h3>
        <p>
          About BIP
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0085.mediawiki" target="_blank">BIP85 page</a>
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
