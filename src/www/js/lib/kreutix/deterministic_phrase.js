const _bip39 = new Mnemonic("english");

function hexToBytes(hex) {
    let bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

function mnemonicToEntropy(mnemonic) {
    const wordlist = WORDLISTS["english"];
    const words = mnemonic.split(' ');
    const bits = words.map(word => {
        const index = wordlist.indexOf(word);
        if (index === -1) {
            throw new Error(`Word '${word}' is not in the wordlist.`);
        }
        return index.toString(2).padStart(11, '0'); // Each word represents 11 bits
    }).join('');

    // Split the bits back into entropy and checksum
    const dividerIndex = Math.floor(bits.length / 33) * 32;
    const entropyBits = bits.slice(0, dividerIndex);
    const entropyBytes = entropyBits.match(/.{1,8}/g).map(bin => parseInt(bin, 2));

    // Convert bytes to hex
    return entropyBytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function xorMnemonic(mnemonic1, mnemonic2) {
    const entropy1 = mnemonicToEntropy(mnemonic1);
    const entropy2 = mnemonicToEntropy(mnemonic2);
    const entropy1Bytes = hexToBytes(entropy1);
    const entropy2Bytes = hexToBytes(entropy2);
    const xorResult = entropy1Bytes.map((byte, i) => byte ^ entropy2Bytes[i]);
    return xorResult.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(str, returnString = false) {
    const result = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.prototype.map.call(new Uint8Array(result), x => ('00' + x.toString(16)).slice(-2)).join('');
}

async function sha256rounds(str, rounds) {
    let hash = await sha256('BITCOIN IS KING');
    for (let i = 0; i < rounds; i++) {
        hash = await sha256(hash + str + hash + str + hash);
    }
    return hash;
}

async function generatePhrase() {
    const rounds = 100000; // Adjust rounds as needed
    let hash = '';
    const userInput = document.getElementById('userInput').value;
    for (let line of userInput.split('\n').filter(line => line.trim() !== '')) {
        console.log(hash + line.trim());
        hash = await sha256rounds(hash + line.trim(), rounds);
        console.log(hash);
    }
    const mnemonic = _bip39.toMnemonic(hexToBytes(hash));
    document.getElementById('mnemonic').value = mnemonic;
    const mnemonicXor = document.getElementById('mnemonicXor').value;
    if (mnemonicXor) {
        const xorResult = xorMnemonic(mnemonic, mnemonicXor);
        document.getElementById('mnemonicXorResult').value = _bip39.toMnemonic(hexToBytes(xorResult));
    }
}

// Add this function at the end of the file
function loadSeed(sourceId) {
    const sourceText = document.getElementById(sourceId).value;
    if (sourceText) {
        // Set the value in the BIP39 Mnemonic textarea
        const bip39PhraseElement = document.getElementById('bip39Phrase');
        bip39PhraseElement.value = sourceText;
        
        // Simulate user input
        bip39PhraseElement.focus();
        bip39PhraseElement.dispatchEvent(new Event('input', { bubbles: true }));
        bip39PhraseElement.dispatchEvent(new Event('change', { bubbles: true }));
        bip39PhraseElement.blur();
        
        // Scroll to the Seed Generation/Input section
        const seedGenerationButton = document.querySelector('button.accordion[title="Click to expand this section"]');
        seedGenerationButton.scrollIntoView({
            behavior: 'smooth'
        });
        
        // Expand the Seed Generation/Input section if it's collapsed
        const seedGenerationPanel = seedGenerationButton.nextElementSibling;
        if (!seedGenerationPanel.style.maxHeight) {
            seedGenerationButton.click(); // This should trigger the expansion
        }

        // Switch to the "Input Mnemonic" tab if it exists
        const inputMnemonicTab = document.querySelector('.tabLinks[title="Show the Mnemonic Input Section"]');
        if (inputMnemonicTab) {
            inputMnemonicTab.click();
        }

    } else {
        alert('No seed to load. Please generate a phrase first.');
    }
}