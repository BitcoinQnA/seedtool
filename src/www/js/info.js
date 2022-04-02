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
  entropy: /*html*/ `
<h3>Entropy</h3>
<h4>What is Entropy?</h4>
<p>
  Entropy in cryptography is <a href="https://en.wikipedia.org/wiki/Entropy_(information_theory)"
    target="_blank">Shannon Entropy</a> from Information Theory, not to be confused with entropy in Physics. In
  information theory, the entropy of a random variable is the average level of "information", "surprise", or
  "uncertainty" inherent to the variable's possible outcomes. It is measured in bits, which can be either a zero or a
  one.
</p>
<h5>A Thought Experiment</h5>
<p>
  In order to visualize this, let's imagine that two people, Alice and Bob, can only communicate using bits, using an
  SMS Text App that only has three buttons, '0', '1' and 'SEND'. Alice is observing a random event that Bob can't see
  and must
  communicate to Bob the outcome of the random event using as few bits as possible. Let's say that Alice and Bob can
  decide together, before the event what the bits will represent.
</p>
<p>
  The first random events Alice has to observe is 10 coin tosses in a row of a fair coin. Fair in this case meaning that
  the probability of heads is the same as the probability of tails. Assume everything is fair from now on and there are
  no dodgy weighted coins or dice. So Alice and Bob decide that a bit that is equal to zero is heads and a bit that is
  equal to one is tails. Alice observes the 10 flips of the coin, records them and sends them to Bob: '1101000111'. This
  information has 10 binary digits which represent 10 bits of entropy of 10 random events, the 10 coin flips. The possible
  different combinations of messages that Alice could have sent Bob are 2<sup>10</sup> which is 1024 combinations
  (2x2x2x2x2x2x2x2x2x2=1024). Alice was able to express the correct outcome with just 10 digits.
</p>
<p>
  In order to make a 12 word seed we need 128 bits of information. This is the same as flipping a coin 128 times and
  recording the results as Alice did for Bob. As before, we can deduce that there are 2<sup>128</sup> combinations. This
  is a rather large number, about 3.4 x 10<sup>38</sup> or about 340,000,000,000,000,000,000,000,000,000,000,000,000. If
  we want to make a 24 word seed, that is 256 bits of entropy, 2<sup>256</sup>, or more than the number of atoms in the
  universe! If we use really good sources of entropy to generate a seed, it makes our funds secure and a person trying
  to guess your seed has more chance of selecting the same atom from all the atoms in the universe as you.
</p>
<p>
  <strong>In order to make the most of this security please read the following carefully:</strong>
</p>
<p>
  Entropy values must be sourced from a <a href="https://en.wikipedia.org/wiki/Random_number_generation"
    target="_blank">strong source of randomness</a>. This means flipping a fair coin, rolling a fair dice, noise
  measurements etc. Do
  <strong>NOT</strong> use phrases from books, lyrics from songs, your birthday or street address, keyboard mashing, or
  anything you <i>think</i> is random, because chances are overwhelming it isn't random enough for the needs of this
  tool, let alone keeping your generational wealth safe!
</p>
<p>
  Entropy values should not include the BIP39 checksum. This is automatically added by the tool.
</p>
<p>
  <strong>Do not store entropy.</strong>
</p>
<p>
  Storing entropy (such as keeping a deck of cards in a specific shuffled order) is unreliable compared to
  storing a mnemonic.
  Instead of storing entropy, store the mnemonic generated from the entropy.
  <a href="https://en.wikipedia.org/wiki/Steganography#Physical" target="_blank">Steganography</a> may be
  beneficial when storing the mnemonic.
</p>
<p>
  The random mnemonic generator on this page uses a <a
    href="https://developer.mozilla.org/en-US/docs/Web/API/RandomSource/getRandomValues" target="_blank">
    cryptographically secure random number generator</a>. The built in random generator can generally be trusted more
  than your own intuition about
  randomness. If cryptographic randomness isn't available in your browser, this page will show a warning and the
  generate button will not work. In that case you might choose to use your own source of entropy.
</p>
<p>
  <a href="https://bitcointalk.org/index.php?topic=311000.msg3345309#msg3345309" target="_blank">You are not a good
    source of entropy.</a>
</p>
<p>
  Card entropy has been implemented assuming cards are replaced, not drawn one after another. This means a full deck of
  cards, shuffled, then draw one card, record that card, replace it, shuffle the cards and draw again. A full deck with
  replacement generates 232 bits of entropy (21 words). A full deck without replacement
  generates 225 bits of entropy (21 words).
</p>
<h4>What do all the Entropy stats mean?</h4>
<p>
  The entropy details provided are there to help you assess how secure your seed is. Let's look at them one at a time.
</p>
<h5>Enter your own entropy:</h5>
<p>
  This allows you to input your own, securely generated entropy. Accepted forms of input are:
</p>
<ul>
  <li><strong>Binary:</strong> (0,1) As per our thought experiment, this is good for flipping a coin, if you have the
    patience!</li>
  <li><strong>Base6:</strong> (0-5) Included mainly because it is needed for rolling dice as dice have 6 sides</li>
  <li><strong>Dice:</strong> (1-6) Used for entering six-sided (D6) dice rolls. Behind the curtain, it subtracts 1 from
    your input to
    convert to Base6</li>
  <li><strong>Base10:</strong> (0-9) The number system we use every day.</li>
  <li><strong>Hex:</strong> (0-9A-F) This system is good for representing large numbers in fewer characters than Base10,
    for example, 0-9 are the same but 10 becomes A and so on until 15 which is F (one character rather than two). This
    efficiency adds up so that the large number with all the zeros above, 2<sup>128</sup>, can be written in hex as
    '100000000000000000000000000000000'. While that is still a lot of characters, you will agree that it is less than
    before! Being a power of 2
    it is also nice for converting to binary and for representing entropy (more on that later). If you have
    16-sided-dice (D16) you can use hex to input your entropy.</li>
  <li><strong>Card:</strong> ([A2-9TJQK][CDHS]) Two characters representing the rank and suit of the card. For example
    ahqs9dtc would be A♥ Q♠ 9♦ T♣</li>
</ul>
<h5>Time to crack:</h5>
<p>
  This uses <a href="https://github.com/dropbox/zxcvbn" target="_blank">zxcvbn</a> which is a password strength
  estimator inspired by password crackers. It is provided to give you an indication of the strength of your entropy.
</p>
<h5>Event Count:</h5>
<p>
  Remember our thought experiment? That was 10 events. 10 coin flips. or for you it might be card draws, or dice rolls.
</p>
<h5>Average bits per event:</h5>
<p>
  This sounds like it should be straightforward. After all, a coin flip is 1 bit (2<sup>1</sup> = 2 outcomes) as we have
  established. Each HEX character is 4 bits (2<sup>4</sup> = 16 outcomes). So we can see that the possible outcomes per
  event = 2<sup>bits per event</sup> or, to switch it round, bits per event = LOG<sub>2</sub>(possible outcomes per
  event).
</p>
<h5>Raw Entropy Words</h5>
<p>
  This tells you how many BIP39 words you can make with the entropy you have provided. It is represented over the amount
  of words you want to make, eg. '21/24'
</p>
<h5>Total Bits:</h5>
<p>
  Displays how many bits of entropy you have so far.
</p>
<h5>Filtered Entropy:</h5>
<p>
  This displays your input less any discarded characters, for example, if you enter 'X' it will be discarded because it
  is not a part of the accepted entropy input types, you will be told that some characters were discarded and it won't
  appear in 'filtered entropy'.
</p>
<h5>Raw Binary:</h5>
<p>
  Shows your input as binary, separated every 11 bits.
</p>
<h5>Binary Checksum:</h5>
<p>
  Displays the checksum of your Raw Binary.
</p>
<h5>Word Indexes:</h5>
<p>
  These numbers represent the index of the BIP39 Mnemonic words and can be changed to different languages.
</p>
<h5>Mnemonic Length:</h5>
<p>
  Also known as mnemonic strength. The number of words in your mnemonic phrase between 12 and 24 in increments of 3. The
  more words, the stronger the seed.
</p>
<h5>Entropy Type / Method:</h5>
<p>
  The page tries to guess what type of entropy you have provided. If it is wrong, You can change it.
</p>
<h4>What does biased entropy mean?</h4>
<p>
  TODO: find a way to explain this... <a href="https://github.com/iancoleman/bip39/issues/435" target="_blank">Bias in
    dice based entropy #435</a>
</p>
  `,
  BIP32: /*html*/ `
  <h3>BIP32: Mnemonic code for generating deterministic keys</h3>
  <p>
    BIP32 defines the standard for generating 'Hierarchical Deterministic (HD)' wallets in bitcoin.
    This BIP enables users to derive an infinite amount of public/private key pairs that are all dererministically 
    linked and recoverable from a single master seed. <br/><br/>BIP32 also enables watch-only wallets in which a 
    user case receive bitcoin and monitor a entire wallet without the need to interact directly
    with a private key. Due to these advancements, BIP32 forms the basis of all modern bitcoin wallets.    
        
  </p>
  <p>
    Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki" target="_blank">BIP32 page </a>
  </p>`,
  BIP39: /*html*/ `
        <h3>BIP39: Mnemonic code for generating deterministic keys</h3>
        <p>
          BIP39 defines a standard for generating a human readable 'Mnemonic Code' (also known as your 'Seed Words') from the generated raw binary. Seed words
          are much easier for humans to manage than the long string of letters and numbers defined in BIP32. Due to the simplified nature of Mnemonics, BIP39 has
          seen wide adoption across 99% of Bitcoin wallets. <br/><br/>Want to move your funds from one wallet to another? Just enter your seed words 
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
        BIP44 defines the standard for deriving P2PKH (Pay to Public Key Hash) addresses, typically referred to as 'Legacy' addresses. This BIP was introduced 
        to solidify the five level hierarchy used on top of the BIP32 'Hieracrhical Deterministic structure' used most modern bitcoin wallets. The five levels
        under the master private key (m) are:-

        <pre>m / purpose’ / coin_type’ / account’ / change / address_index</pre>
        
        BIP44 also uses similar address types to BIP32, beginning with a <b>'1'</b> and defines that wallets adopting the standard should adopt the <b>'xpub'</b> or <b>'xprv'</b>
        prefixes when displaying extended public/private keys. These legacy tpye addresses are rarely used in modern bitcoin wallets due to
        their larger transaction size resulting in larger fees.
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki" target="_blank">BIP44 page</a>
        </p>`,
  BIP47: /*html*/ `
        <h3>BIP47: Reusable Payment Codes for Hierarchical Deterministic Wallets</h3>
        <p>
        BIP47 defines the standard for creating a payment code which can be publicly advertised and associated with a real-life identity (or pseudonym) without 
        creating the loss of security or privacy inherent to address re-use. BIP47 does not define an address type, but does define a way for Alice to generate
        receiving addresses for Bob without having to directly interact with him and knowing only his public payment code. <br/><br/> 
        At the time of writing, the only wallets supporting BIP47 are Samourai and Sparrow. Although here is active development for implementations
        into BDK and BlueWallet.  

        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0047.mediawiki" target="_blank">BIP47 page</a>
        </p>`,
  BIP49: /*html*/ `
        <h3>BIP49: Derivation scheme for P2WPKH-nested-in-P2SH based accounts</h3>
        <p>
        BIP49 defines the standard for deriving P2SH-P2WPKH (Pay to Script Hash - Pay to Witness Public Key Hash) addresses, typically referred to as 
        'Wrapped Segwit' addresses. This BIP was introduced as a compatability fix to enable older wallets to send to wallets conforming to newer standards.
        Wrapped Segwit addresses beginning with <b>'3'</b> save on transaction fees when compared to older legacy types. This saving, although not as large as
        those gained by wallets adopting Native Segwit, is achieved via an optimised transaction structure. <br/><br/>
        BIP49 also defines that wallets adopting the standard should adopt the <b>'ypub'</b> or <b>'yprv'</b> prefixes when displaying extended public/private keys.
        Wrapped Segwit addresses defined in this BIP are quickly being replaced in wallet software by those confirming to the BIP84 standard.
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki" target="_blank">BIP49 page</a>
        </p>`,
  BIP84: /*html*/ `
        <h3>BIP84: Derivation scheme for P2WPKH based accounts</h3>
        <p>
          BIP84 defines the standard for deriving P2WPKH (Pay to Withness Public Key Hash) addresses, typically referred to as 'Native Segwit' addresses.
          Segwit addresses beginning with <b>'bc1q'</b> are the most commonly used address type for modern bitcoin wallets. This is due to their ability to construct
          smaller transactions that save the user fees when spending. <br/><br/>

          BIP84 also defines that wallets adopting the standard should adopt the <b>'zpub'</b> or <b>'zprv'</b> prefixes when displaying extended public/private keys.
        </p>
        <p>
          Read more on the official <a href="https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki" target="_blank">BIP84 page</a>
        </p>`,
  BIP85: /*html*/ `
        <h3>BIP85: Deterministic Entropy From BIP32 Keychains</h3>
        <p>
         BIP85 defines the standard for 'One seed to rule them all'. With BIP85 a user can derive multiple 'Child Seeds' from a single master mnemonic seed.
         This enables a user to populate the seed words of many wallets whilst only having a physical backup of a single master mnemonic. <br/><br/> Should a child seed 
         be lost with no offline backup, it can be regenerated in any BIP85 compatible hardware or software, so long as the user knows the master mnemonic 
         and index number of the lost child seed.    
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
