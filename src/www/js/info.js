window.infoHtml = {
  entropy: /*html*/ `<h5>(NOTE TEXT IS EXAMPLE)</h5>
        <h3 id="entropy-notes">Entropy</h3>
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
};
