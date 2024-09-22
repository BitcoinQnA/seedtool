/**
__||__ _ _            _       _____        ___  
| ___ (_) |          (_)     |  _  |      / _ \ 
| |_/ /_| |_ ___ ___  _ _ __ | | | |_ __ / /_\ \
| ___ \ | __/ __/ _ \| | '_ \| | | | '_ \|  _  |
| |_/ / | || (_| (_) | | | | \ \/' / | | | | | |
\____/|_|\__\___\___/|_|_| |_|\_/\_\_| |_\_| |_/
  ||                                              
                                                
 _____               _   _____           _ 
/  ___|             | | |_   _|         | |
\ `--.  ___  ___  __| |   | | ___   ___ | |
 `--. \/ _ \/ _ \/ _` |   | |/ _ \ / _ \| |
/\__/ /  __/  __/ (_| |   | | (_) | (_) | |
\____/ \___|\___|\__,_|   \_/\___/ \___/|_|
                                           
*/
let seed = null;
let bip32RootKey = null;
let bip32ExtendedKey = null;
let currentBip = 'bip32';
let network;
let isTestnet = false;
let wordList = [];
let myPayCode = null;
let bobPayCode = null;
let entropyTypeAutoDetect = true;
let lastInnerWidth = parseInt(window.innerWidth);
let libTimeout = null;
let libTimeoutCount = 0;
let hidePrivateData = false;
const bip85Lineage = [];
const generationProcesses = [];
const networks = {
  bitcoin: {
    bip49: {
      messagePrefix: '\x18Bitcoin Signed Message:\n',
      bip32: {
        public: 0x049d7cb2,
        private: 0x049d7878,
      },
      pubKeyHash: 0x00,
      scriptHash: 0x05,
      wif: 0x80,
    },
    bip84: {
      messagePrefix: '\x18Bitcoin Signed Message:\n',
      bech32: 'bc',
      bip32: {
        public: 0x04b24746,
        private: 0x04b2430c,
      },
      pubKeyHash: 0x00,
      scriptHash: 0x05,
      wif: 0x80,
    },
  },
  testnet: {
    bip49: {
      messagePrefix: '\x18Bitcoin Signed Message:\n',
      bip32: {
        public: 0x044a5262,
        private: 0x044a4e28,
      },
      pubKeyHash: 0x6f,
      scriptHash: 0xc4,
      wif: 0xef,
    },
    bip84: {
      messagePrefix: '\x18Bitcoin Signed Message:\n',
      bech32: 'tb',
      bip32: {
        public: 0x045f1cf6,
        private: 0x045f18bc,
      },
      pubKeyHash: 0x6f,
      scriptHash: 0xc4,
      wif: 0xef,
    },
  },
};

/**
 * Setup the DOM for interaction
 */
// Store elements in DOM object to reference everywhere
const DOM = {};
const setupDom = async () => {
  // run a quick check that the browser is modern enough to handle this
  if (thisBrowserIsShit()) {
    alert(
      'Your browser is outdated and is unable to run this tool. Please update it or use a modern browser instead.'
    );
    return;
  }
  // Test to see if all the libraries are ready
  if (
    !window.bip32 ||
    !window.bip39 ||
    !window.bip47 ||
    !window.bip85 ||
    !window.bitcoin ||
    !window.diceware ||
    !window.Entropy ||
    !window.Levenshtein ||
    !window.zxcvbn
  ) {
    // check we are not in a loop
    if (libTimeoutCount > 30) {
      // 9 seconds: something must be wrong
      alert('Something has gone wrong. please try to reload the page');
      return;
    }
    // Log this
    console.log(`Waiting for libs... delay number: ${libTimeoutCount}`);
    // try again in a bit
    libTimeoutCount++;
    libTimeout = setTimeout(setupDom, 300);
    return;
  } else {
    // clear timeout and counter
    libTimeoutCount = 0;
    libTimeout = null;
  }
  // store html elements
  DOM.accordionButtons = document.querySelectorAll('.accordion');
  DOM.accordionPanels = document.querySelectorAll('.panel');
  DOM.firstPanel = document.getElementById('firstPanel');
  DOM.allTabContents = document.querySelectorAll('.tabContent');
  DOM.allTabLinks = document.querySelectorAll('.tabLinks');
  DOM.allBipsContents = document.querySelectorAll('.bipsContent');
  DOM.generateRandomStrengthSelect = document.getElementById(
    'generateRandomStrength'
  );
  DOM.mnemonicLengthSelect = document.getElementById('mnemonicLengthSelect');
  DOM.copyWrapper = document.querySelectorAll('.copy-wrapper');
  DOM.generateButton = document.querySelector('.btn.generate');
  DOM.bip32RootKey = document.getElementById('bip32RootKey');
  DOM.bip32RootFingerprint = document.getElementById('bip32RootFingerprint');
  DOM.bip32RootWif = document.getElementById('bip32RootWif');
  DOM.entropyFilterWarning = document.getElementById('entropy-discarded-chars');
  DOM.entropyDisplay = document.querySelector('input[id="entropyDetails"]');
  DOM.entropyInput = document.getElementById('entropy');
  DOM.toastMessage = document.getElementById('toast');
  DOM.entropyTimeToCrack = document.getElementById('entropyTimeToCrack');
  DOM.entropyEventCount = document.getElementById('entropyEventCount');
  DOM.entropyEntropyType = document.getElementById('entropyEntropyType');
  DOM.entropyBitsPerEvent = document.getElementById('entropyBitsPerEvent');
  DOM.entropyRawWords = document.getElementById('entropyRawWords');
  DOM.entropyTotalBits = document.getElementById('entropyTotalBits');
  DOM.entropyFiltered = document.getElementById('entropyFiltered');
  DOM.entropyRawBinary = document.getElementById('entropyRawBinary');
  DOM.entropyBinaryChecksum = document.getElementById('entropyBinaryChecksum');
  DOM.entropyWordIndexes = document.getElementById('entropyWordIndexes');
  DOM.entropyMnemonicLengthSelect = document.getElementById(
    'entropyMnemonicLength'
  );
  DOM.entropyWeakEntropyOverrideWarning = document.getElementById(
    'weakEntropyOverrideWarning'
  );
  DOM.entropyWeakEntropyWarning = document.getElementById('weakEntropyWarning');
  DOM.entropyMethod = document.getElementById('entropyMethod');
  DOM.bip39Phrase = document.getElementById('bip39Phrase');
  DOM.bip39PhraseSplit = document.getElementById('bip39PhraseSplit');
  DOM.bip39PhraseSplitWarn = document.getElementById('bip39PhraseSplitWarn');
  DOM.bip39SplitMnemonicSection = document.getElementById('splitMnemonic');
  DOM.bip39Passphrase = document.getElementById('bip39Passphrase');
  DOM.bip39PassphraseCrackTime = document.getElementById(
    'bip39PassphraseCrackTime'
  );
  DOM.bitcoinToolSelect = document.getElementById('bitcoinToolSelect');
  DOM.hidePassphraseGeneration = document.getElementById(
    'hidePassphraseGeneration'
  );
  DOM.bip39PassGenSection = document.getElementById('bip39PassGenSection');
  DOM.bip39PassGenInput = document.getElementById('bip39PassGenInput');
  DOM.bip39Seed = document.getElementById('bip39Seed');
  DOM.bip39Invalid = document.querySelector('.bip39-invalid-phrase');
  DOM.bip39InvalidMessage = document.getElementById('bip39ValidationError');
  DOM.hidePassphraseTest = document.getElementById('hidePassphraseTest');
  DOM.bip39PassTestSection = document.getElementById('bip39PassTestSection');
  DOM.bip39PassTestBtn = document.getElementById('bip39PassTestBtn');
  DOM.pathCoin = document.getElementById('pathCoin');
  DOM.pathAccount = document.getElementById('pathAccount');
  DOM.pathChange = document.getElementById('pathChange');
  DOM.pathAccountXprv = document.getElementById('pathAccountXprv');
  DOM.pathAccountXpub = document.getElementById('pathAccountXpub');
  DOM.pathPurpose = document.getElementById('pathPurpose');
  DOM.pathInputSection = document.getElementById('pathInputSection');
  DOM.path = document.getElementById('path');
  DOM.bip85Application = document.getElementById('bip85Application');
  DOM.bip85MnemonicLength = document.getElementById('bip85MnemonicLength');
  DOM.bip85Bytes = document.getElementById('bip85Bytes');
  DOM.bip85Index = document.getElementById('bip85Index');
  DOM.bip85ChildKey0 = document.getElementById('bip85ChildKey0');
  DOM.bip85ChildKey1 = document.getElementById('bip85ChildKey1');
  DOM.bip85ChildKey2 = document.getElementById('bip85ChildKey2');
  DOM.bip85ChildKey3 = document.getElementById('bip85ChildKey3');
  DOM.bip85ChildKey4 = document.getElementById('bip85ChildKey4');
  DOM.bip85LoadParent = document.getElementById('bip85LoadParent');
  DOM.bip47UsePaynym = document.getElementById('bip47UsePaynym');
  DOM.bip47MyPaymentCode = document.getElementById('bip47MyPaymentCode');
  DOM.bip47MyNotificationAddress = document.getElementById(
    'bip47MyNotificationAddress'
  );
  DOM.bip47MyNotificationPubKey = document.getElementById(
    'bip47MyNotificationPubKey'
  );
  DOM.bip47MyNotificationPrvKey = document.getElementById(
    'bip47MyNotificationPrvKey'
  );
  DOM.bip47PaynymSections = document.querySelectorAll('.bip47PaynymSection');
  DOM.bip47CPPaymentCode = document.getElementById('bip47CPPaymentCode');
  DOM.bip47CPGenSection = document.getElementById('bip47CPGenSection');
  DOM.bip47CPNotificationAddress = document.getElementById(
    'bip47CPNotificationAddress'
  );
  DOM.bip47CPNotificationPubKey = document.getElementById(
    'bip47CPNotificationPubKey'
  );
  DOM.bip47CsvDownloadLink = document.querySelector('.bip47-csv-download-link');
  DOM.bip47AddressListContainer = document.querySelector(
    '#bip47AddressDisplay'
  );
  DOM.bip47AddressType = document.querySelector('#bip47AddressType');
  DOM.bip47SendReceive = document.querySelector('#bip47SendReceive');
  DOM.bip47StartIndex = document.querySelector('#bip47StartIndex');
  DOM.bip47NoOfAddresses = document.querySelector('#bip47NoOfAddresses');
  DOM.bip47AddressSection = document.getElementById('bip47AddressSection');
  DOM.bip47Network = document.getElementById('bip47NetworkSelect');
  DOM.csvDownloadLink = document.querySelector('.csv-download-link');
  DOM.addressListContainer = document.querySelector('.address-display-content');
  DOM.addressGenerateButton = document.querySelector(
    '.address-button-generate'
  );
  DOM.derivedPathSelect = document.getElementById('derivedPathSelect');
  DOM.bip141ScriptSelectDiv = document.querySelector('.bip141-script-select');
  DOM.bip141ScriptSelect = document.getElementById('bip141ScriptSemantics');
  DOM.bip32AccountXprv = document.getElementById('bip32AccountXprv');
  DOM.bip32AccountXpub = document.getElementById('bip32AccountXpub');
  DOM.showHide = document.getElementById('showHide');
  DOM.onlineIcon = document.getElementById('networkIndicator');
  DOM.infoModal = document.getElementById('infoModal');
  DOM.infoModalText = document.getElementById('infoModalText');
  DOM.qrModal = document.getElementById('qrModal');
  DOM.qrModalDiv = document.getElementById('qrModalDiv');
  DOM.lastWordBits = document.querySelectorAll('.lastWord-bit');
  DOM.lastWordLength = document.getElementById('lastWordStrength');
  DOM.lastWordZeroWarning = document.getElementById('lastWordZeroWarning');
  DOM.lastWordFinalWord = document.querySelectorAll('.lastWord-word')[23];
  DOM.msCsvDownloadLink = document.querySelector(
    '.multisigXpubs-csv-download-link'
  );
  DOM.msAddressListContainer = document.querySelector(
    '#multisigXpubsAddressDisplay'
  );
  DOM.singleSigInput = document.getElementById('singleSigInput');
  DOM.mnemonicInputs = document.querySelectorAll('.inputMnemonic-div');
  DOM.singleSigInput.oninput = singleSigCalc;
  // Event listener to clear autocomplete suggestions
  document.addEventListener('click', (e) => clearAutocompleteItems(e.target));
  // move autocomplete suggestions on scroll
  document.addEventListener('scroll', autocompletePositionUpdate);
  // Autocomplete key presses
  document
    .querySelectorAll('.lastWord-word')
    .forEach((input) =>
      input.addEventListener('keydown', keyPressAutocompleteHandler)
    );
  document
    .querySelectorAll('.inputMnemonic-word')
    .forEach((input) =>
      input.addEventListener('keydown', keyPressAutocompleteHandler)
    );
  // Flip bits when clicked
  DOM.lastWordBits.forEach((bit) => {
    bit.addEventListener('click', () => {
      bit.classList.toggle('is-flipped');
      getBits();
      calculateLastWord();
    });
  });
  // Change bits and word inputs when strength changes
  DOM.lastWordLength.oninput = changeLastWordLength;
  // Set it now
  changeLastWordLength();
  // set network now
  network = bitcoin.networks.bitcoin;
  // BIP39 Tool select
  DOM.bitcoinToolSelect.oninput = selectBitcoinTool;
  DOM.bip39PassTestBtn.onclick = bip39PassphraseTest;
  // hide private data
  DOM.showHide.onclick = toggleHideAllPrivateData;
  // listen for entropy method changes
  DOM.entropyMethod.oninput = entropyTypeChanged;
  // listen for address generate button clicks
  DOM.addressGenerateButton.onclick = generateAddresses;
  DOM.path.oninput = generateAddresses;
  // listen for change in derivedPathSelect
  DOM.derivedPathSelect.oninput = derivedPathSelectChanged;
  // call now to select defaults
  derivedPathSelectChanged();
  // listen for bip47 changes
  DOM.bip47UsePaynym.oninput = togglePaynym;
  DOM.bip47CPPaymentCode.oninput = calcBip47CounterParty;
  DOM.bip47AddressType.oninput = calculateBip47Addresses;
  DOM.bip47SendReceive.oninput = calculateBip47Addresses;
  DOM.bip47StartIndex.oninput = calculateBip47Addresses;
  DOM.bip47NoOfAddresses.oninput = calculateBip47Addresses;
  DOM.bip47Network.oninput = () => {
    calcBip47();
    calcBip47CounterParty();
    calculateBip47Addresses();
  };
  // listen for bip85 changes
  DOM.bip85Application.oninput = calcBip85;
  DOM.bip85MnemonicLength.oninput = calcBip85;
  DOM.bip85Bytes.oninput = calcBip85;
  DOM.bip85Index.oninput = calcBip85;
  DOM.bip85LoadParent.onclick = bip85LoadParent;
  // Accordion Sections
  DOM.accordionButtons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      btn.classList.toggle('accordion--active');
      const panel = btn.nextElementSibling;
      panel.classList.toggle('accordion-panel--active');
      adjustPanelHeight();
    });
  });
  // Copy button
  DOM.copyWrapper.forEach(setupCopyButton);
  // Make sure that the generate seed tab is open
  document.getElementById('defaultOpenTab').click();
  // Setup one click copy
  document.querySelectorAll('.one-click-copy').forEach((textElement) => {
    textElement.onclick = copyEventHandler;
  });
  // add listener for bip44 path inputs
  DOM.pathCoin.oninput = changePath;
  DOM.pathAccount.oninput = changePath;
  DOM.pathChange.oninput = changePath;
  // add event listener for entropy
  DOM.entropyInput.oninput = entropyChanged;
  DOM.entropyMnemonicLengthSelect.oninput = entropyChanged;
  // link length selectors together
  DOM.generateRandomStrengthSelect.oninput = () => {
    DOM.entropyMnemonicLengthSelect.value =
      DOM.generateRandomStrengthSelect.value;
    DOM.mnemonicLengthSelect.value = DOM.generateRandomStrengthSelect.value;
    mnemonicInputLengthAdjust();
  };
  DOM.mnemonicLengthSelect.oninput = () => {
    DOM.entropyMnemonicLengthSelect.value = DOM.mnemonicLengthSelect.value;
    DOM.generateRandomStrengthSelect.value = DOM.mnemonicLengthSelect.value;
    mnemonicInputLengthAdjust();
  };
  // add event listener for new mnemonic / passphrase
  DOM.bip39Passphrase.oninput = mnemonicToSeedPopulate;
  DOM.bip39Phrase.oninput = mnemonicToSeedPopulate;
  DOM.bip39PassGenInput.oninput = diceToPassphrase;
  // Add event listener to generate new mnemonic
  DOM.generateButton.addEventListener('click', generateNewMnemonic);
  // update pointer to word list
  wordList = bip39.wordlists[Object.keys(bip39.wordlists)[0]];
  // show user when connected to a network for security
  window.addEventListener('offline', () => {
    DOM.onlineIcon.classList.add('hidden');
  });
  window.addEventListener('online', () => {
    DOM.onlineIcon.classList.remove('hidden');
  });
  // set it now
  if (window.navigator.onLine) {
    DOM.onlineIcon.classList.remove('hidden');
  } else {
    DOM.onlineIcon.classList.add('hidden');
  }
  // Multisig listeners
  document.querySelectorAll('.multisig-oninput').forEach((i) => {
    i.oninput = calcMultisigFromXpubs;
  });
  // Listen for OTP button clicks
  document.getElementById('otpGenerate').onclick = generateOneTimePad;
  document.getElementById('otpEncrypt').onclick = encryptOneTimePad;
  document.getElementById('otpDecrypt').onclick = decryptOneTimePad;
  // Watch for changes in the window size to change textarea boxes
  resizeObserver.observe(document.querySelector('body'));
  // Remove loading screen
  document.getElementById('loadingPage').style.display = 'none';
  mnemonicInputLengthAdjust();
  // Pause for dramatic effect
  await sleep(200);
  // open the about panel on load
  DOM.firstPanel.click();
};

// Run setupDom function when the page has loaded
window.addEventListener('DOMContentLoaded', setupDom);

// Helper function to reorder the event stack
const sleep = (time = 0) => new Promise((r) => setTimeout(r, time));

/**
 * Test for the features we use
 * return true if not available
 * @returns {boolean}
 */
const thisBrowserIsShit = () => {
  let isShit = false;
  if (
    // check crypto
    !window.crypto ||
    !window.crypto.getRandomValues ||
    !window.crypto.subtle ||
    // check copy to clipboard
    !navigator.clipboard ||
    // template check
    !('content' in document.createElement('template')) ||
    // TextEncoder
    !TextEncoder ||
    // check String.prototype.normalize
    !String.prototype.normalize
  )
    isShit = true;

  // return result
  return isShit;
};

// Load seed from mnemonic input
const mnemonicInputSeedLoad = () => {
  const errorText = document.getElementById('inputMnemonicError');
  errorText.classList.add('hidden');
  try {
    const len = parseInt(DOM.mnemonicLengthSelect.value);
    if (isNaN(len)) {
      throw new Error('mnemonic length is not a number');
    }
    const mnemonicArray = [];
    DOM.mnemonicInputs.forEach((div, i) => {
      if (i < len) {
        const word = normalizeString(div.querySelector('input').value);
        if (!wordList.includes(word)) {
          const nearestWord = findNearestWord(word);
          throw new Error(
            word
              ? `${word} (at position ${
                  i + 1
                }) is not in the BIP39 English word list, please check it and try again. Did you mean "${nearestWord}"?`
              : `Missing word (at position ${i + 1})`
          );
        }
        mnemonicArray.push(word);
      }
    });
    if (!bip39.validateMnemonic(mnemonicArray.join(' '))) {
      throw new Error('Invalid Mnemonic Phrase! Unable to load seed.');
    }
    DOM.bip39Phrase.value = mnemonicArray.join(' ');
    DOM.mnemonicLengthSelect.value = mnemonicArray.length;
    DOM.entropyMnemonicLengthSelect.value = DOM.mnemonicLengthSelect.value;
    DOM.generateRandomStrengthSelect.value = DOM.mnemonicLengthSelect.value;
    mnemonicInputLengthAdjust();
    mnemonicToSeedPopulate();
  } catch (e) {
    console.error(e);
    errorText.innerText = e;
    errorText.classList.remove('hidden');
  }
  adjustPanelHeight();
};

// Change the number of boxes based on mnemonic length
const mnemonicInputLengthAdjust = () => {
  const len = parseInt(DOM.mnemonicLengthSelect.value);
  if (isNaN(len)) {
    console.error('mnemonic length is not a number');
    return;
  }
  DOM.mnemonicInputs.forEach((div, i) => {
    div.classList.toggle('hidden', i >= len);
  });
};

// Show/Hide all private data
const toggleHideAllPrivateData = () => {
  hidePrivateData = !hidePrivateData;
  document.getElementById('hideIcon').classList.toggle('hidden');
  document.getElementById('showIcon').classList.toggle('hidden');
  document.querySelectorAll('.private-data').forEach((el) => {
    el.style.display = hidePrivateData ? 'none' : '';
  });
  adjustPanelHeight();
};

const calcMultisigFromXpubs = () => {
  const isXpubForMultisig = (xpub) => {
    return ['Ypub', 'Zpub'].includes(xpub.substring(0, 4));
  };
  const convertMultisigXpubToRegularXpub = (Zpub) => {
    let data = bs58check.decode(Zpub);
    data = data.slice(4);
    return bs58check.encode(
      Buffer.Buffer.concat([Buffer.Buffer.from('0488b21e', 'hex'), data])
    );
  };
  const multiSigInput = document.getElementById('multisigXpubs').value;
  const errorBox = document.getElementById('multisigXpubsError');
  errorBox.classList.add('hidden');
  DOM.msAddressListContainer.innerHTML = '';
  try {
    const m = parseInt(document.getElementById('multisigXpubsThreshold').value);
    if (isNaN(m) || m < 1)
      throw new Error('Threshold must be a positive integer');
    const Zpubs = multiSigInput.split('\n').filter((x) => x !== '');
    const n = Zpubs.length;
    let e = false;
    Zpubs.forEach((x) => {
      if (!isXpubForMultisig(x) || !x.startsWith(Zpubs[0].substring(0, 4)))
        e = true;
    });
    if (e)
      throw new Error(
        'Please use Zpubs for Native Segwit and Ypubs for Wrapped Segwit'
      );
    if (m > n)
      throw new Error('Threshold cannot be greater than number of cosigners');
    const isNativeSegwit = Zpubs[0].startsWith('Z');
    const change = parseInt(
      document.getElementById('multisigXpubsChangeSelect').value
    );
    const xpubs = Zpubs.map((z) => convertMultisigXpubToRegularXpub(z));
    const rootPath = `${
      isNativeSegwit ? `m/48'/0'/0'/2'` : `m/48'/0'/0'/1'`
    }/${change}/`;
    const startIndex = parseInt(
      document.getElementById('multisigXpubsStartIndex').value
    );
    const totalAddresses = parseInt(
      document.getElementById('multisigXpubsNoOfAddresses').value
    );
    if (isNaN(startIndex) || isNaN(totalAddresses))
      throw new Error('Number is required for address index');
    const addresses = [];
    for (let i = 0; i < totalAddresses; i++) {
      const path = `${rootPath}${startIndex + i} (${m} of ${n})`;
      const pubkeys = xpubs
        .map((x) => bip32.fromBase58(x).derive(change).derive(i).publicKey)
        .sort(Buffer.Buffer.compare);
      const address = isNativeSegwit
        ? bitcoin.payments.p2wsh({
            redeem: bitcoin.payments.p2ms({ m, pubkeys }),
          }).address
        : bitcoin.payments.p2sh({
            redeem: bitcoin.payments.p2wsh({
              redeem: bitcoin.payments.p2ms({ m, pubkeys }),
            }),
          }).address;
      addresses.push(new AddressData(path, address));
    }
    injectAddresses(
      addresses,
      DOM.msCsvDownloadLink,
      DOM.msAddressListContainer
    );
  } catch (error) {
    console.error(error);
    errorBox.innerText = error;
    errorBox.classList.remove('hidden');
  }
  adjustPanelHeight();
};

const multiSigCalc = () => {
  const multiSigInput = document.getElementById('multiSigInput').value;
  const errorBox = document.getElementById('multiSigError');
  errorBox.classList.add('hidden');
  const addressResult = document.getElementById('multiSigAddress');
  addressResult.value = '';
  try {
    const m = parseInt(document.getElementById('multiSigThreshold').value);
    const pubkeys = multiSigInput
      .split('\n')
      .map((hex) => Buffer.Buffer.from(hex, 'hex'))
      .sort(Buffer.Buffer.compare);
    let e = false;
    pubkeys.forEach((k) => {
      if (k.length !== 33) e = true;
    });
    if (e) throw new Error('Invalid Public Keys');
    const legacy = () => {
      const { address } = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2ms({
          m,
          pubkeys,
        }),
      });

      return address;
    };
    const wrapped = () => {
      const { address } = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wsh({
          redeem: bitcoin.payments.p2ms({ m, pubkeys }),
        }),
      });
      return address;
    };
    const native = () => {
      const { address } = bitcoin.payments.p2wsh({
        redeem: bitcoin.payments.p2ms({ m, pubkeys }),
      });
      return address;
    };
    if (isNaN(m) || m > pubkeys.length || m < 1)
      throw new Error('Invalid Threshold');
    addressResult.innerHTML = `${m} of ${
      pubkeys.length
    } MULTISIG<br>LEGACY<span class="qr-button-holder" id="multiSigAddressQRLegacy"></span>:         ${legacy()}<br>WRAPPED SEGWIT<span class="qr-button-holder" id="multiSigAddressQRWrapped"></span>: ${wrapped()}<br>NATIVE SEGWIT<span class="qr-button-holder" id="multiSigAddressQRNative"></span>:  ${native()}`;
    addQRIcon(
      addressResult.querySelector('#multiSigAddressQRLegacy'),
      legacy()
    );
    addQRIcon(
      addressResult.querySelector('#multiSigAddressQRWrapped'),
      wrapped()
    );
    addQRIcon(
      addressResult.querySelector('#multiSigAddressQRNative'),
      native()
    );
  } catch (error) {
    console.error(error);
    errorBox.innerText = error;
    errorBox.classList.remove('hidden');
  }
  adjustPanelHeight();
};

// single sig tool
const singleSigCalc = () => {
  const errorBox = document.getElementById('singleSigError');
  errorBox.classList.add('hidden');
  const addressResult = document.getElementById('singleSigAddress');
  addressResult.value = '';
  const pubResult = document.getElementById('singleSigPub');
  pubResult.value = '';
  const privInput = DOM.singleSigInput.value;
  try {
    let keyPair;
    const legacy = (network) => {
      const { address } = bitcoin.payments.p2pkh({
        pubkey: keyPair.publicKey,
        network,
      });
      return address;
    };
    const wrapped = (network) => {
      const { address } = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network }),
      });
      return address;
    };
    const native = (network) => {
      const { address } = bitcoin.payments.p2wpkh({
        pubkey: keyPair.publicKey,
        network,
      });
      return address;
    };
    const taproot = (network) => {
      return bip86.getP2TRAddress(
        keyPair.publicKey,
        network.bech32.startsWith('t')
      );
    };
    let net = networks.bitcoin.bip84;
    let isHex =
      privInput.length === 64 && !!privInput.match(/\p{Hex_Digit}{64}/isu);
    if (isHex) {
      keyPair = bitcoin.ECPair.fromPrivateKey(
        Buffer.Buffer.from(privInput, 'hex')
      );
    } else {
      // it's a wif maybe?
      if (!privInput.match(/^[5KL9c][1-9A-HJ-NP-Za-km-z]{50,51}$/))
        throw new Error('Invalid Private Key');
      net = /^[9c]/.test(privInput)
        ? networks.testnet.bip84
        : networks.bitcoin.bip84;
      keyPair = bitcoin.ECPair.fromWIF(privInput, net);
    }
    pubResult.value = keyPair.publicKey.toString('hex');
    addressResult.innerHTML = `LEGACY<span class="qr-button-holder" id="singleSigAddressQRLegacy"></span>:         ${legacy(
      net
    )}<br>WRAPPED SEGWIT<span class="qr-button-holder" id="singleSigAddressQRWrapped"></span>: ${wrapped(
      net
    )}<br>NATIVE SEGWIT<span class="qr-button-holder" id="singleSigAddressQRNative"></span>:  ${native(
      net
    )}<br>TAPROOT<span class="qr-button-holder" id="singleSigAddressQRTaproot"></span>:  ${taproot(
      net
    )}`;
    addQRIcon(
      addressResult.querySelector('#singleSigAddressQRLegacy'),
      legacy(net)
    );
    addQRIcon(
      addressResult.querySelector('#singleSigAddressQRWrapped'),
      wrapped(net)
    );
    addQRIcon(
      addressResult.querySelector('#singleSigAddressQRNative'),
      native(net)
    );
    addQRIcon(
      addressResult.querySelector('#singleSigAddressQRTaproot'),
      taproot(net)
    );
  } catch (error) {
    console.error(error);
    errorBox.innerText = error;
    errorBox.classList.remove('hidden');
  }
  adjustPanelHeight();
};

const randPriv = () => {
  DOM.singleSigInput.value = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  singleSigCalc();
};

// Select a Bitcoin Tool
const selectBitcoinTool = () => {
  document
    .querySelectorAll('.bip39ToolSection')
    .forEach((s) => s.classList.add('hidden'));
  const section = document.getElementById(DOM.bitcoinToolSelect.value);
  if (section) {
    section.classList.remove('hidden');
    if (DOM.bitcoinToolSelect.value === 'lastWord') randEntropy();
  }
  adjustPanelHeight();
};

// Flip a bit for last word entropy
const flip = async (bit, spins) => {
  if (spins === 0) return;
  await sleep(100);
  bit.classList.toggle('is-flipped');
  spins--;
  flip(bit, spins);
};

// Randomize last word entropy
const randEntropy = () => {
  let bitString = '';
  DOM.lastWordBits.forEach((bit, i) => {
    // reset bits to zero
    bit.classList.remove('is-flipped');
    if (bit.classList.contains('hidden')) return;
    const bits = crypto
      .getRandomValues(new Uint8Array(1))[0]
      .toString(2)
      .padStart(8, '0')
      .split('');
    const thisBit = bits[7 - i];
    bitString += thisBit;
    // Math random is not used for entropy
    // it is just used to make an arbitrary even number for the animation
    // so that the bits complete flipping at different times
    const n = (Math.floor(Math.random() * 7) + 7) * 2 + parseInt(thisBit);
    flip(bit, n);
  });
  DOM.lastWordZeroWarning.classList.toggle('hidden', bitString.includes('1'));
  adjustPanelHeight();
  calculateLastWord(bitString);
};

// get last word user entropy
const getBits = () => {
  let bitString = '';
  DOM.lastWordBits.forEach((bit) => {
    if (!bit.classList.contains('hidden')) {
      bitString += bit.classList.contains('is-flipped') ? '1' : '0';
    }
  });
  DOM.lastWordZeroWarning.classList.toggle('hidden', bitString.includes('1'));
  adjustPanelHeight();
  return bitString;
};

// last word mnemonic length change handler
const changeLastWordLength = () => {
  // change number of bits
  const numWords = parseInt(DOM.lastWordLength.value);
  const n = 11 - numWords / 3;
  DOM.lastWordBits.forEach(async (bit, i) => {
    bit.classList.toggle('hidden', i >= n);
  });
  randEntropy();
  // hide unused words
  document.querySelectorAll('.lastWord-div').forEach((el, i) => {
    el.classList.toggle('hidden', i >= numWords);
    const input = el.querySelector('.lastWord-word');
    input.readOnly = i + 1 === numWords;
    if (i + 1 === numWords) {
      DOM.lastWordFinalWord = input;
    }
  });
  calculateLastWord();
};

// calc last word
const calculateLastWord = debounce(async (entBits = getBits()) => {
  const numWords = parseInt(DOM.lastWordLength.value);
  const words = [];
  const userWordElements = document.querySelectorAll('.lastWord-word');
  userWordElements.forEach((el, i) => {
    if (i + 1 < numWords) words.push(normalizeString(el.value).toLowerCase());
  });
  // check the user has entered enough words
  if (words.includes('')) {
    DOM.lastWordFinalWord.value = '';
    canLoadLastWordSeed(false);
    return;
  }
  const wordIndexes = words.map((w) => wordList.indexOf(w));
  // check all words exist
  let wordsAreWrong = false;
  wordIndexes.forEach((wi, i) => {
    if (wi === -1) wordsAreWrong = true;
    userWordElements[i].style.backgroundColor = wi === -1 ? 'red' : '';
  });
  if (wordsAreWrong) {
    // one or more of the words are wrong
    DOM.lastWordFinalWord.value = '';
    canLoadLastWordSeed(false);
    return;
  }
  const bin =
    wordIndexes.map((n) => n.toString(2).padStart(11, '0')).join('') + entBits;
  const binBytes = bin.match(/[0-1]{8}/g);
  const arr = binBytes.map((b) => parseInt(b, 2));
  const buf = new Uint8Array(arr);
  const checkSumBits = await deriveChecksumBits(buf);
  const lastWordBits = entBits + checkSumBits;
  const lastWord = wordList[parseInt(lastWordBits, 2)];
  DOM.lastWordFinalWord.value = lastWord;
  canLoadLastWordSeed(true);
}, 1000);

// Autocomplete
const currentAuto = {
  input: null,
  focus: -1,
  term: '',
};
const clearAutocompleteItems = (el) => {
  document.querySelectorAll('.autocomplete-items').forEach((item) => {
    if (el !== item && el !== currentAuto.input)
      item.parentNode.removeChild(item);
  });
};
const lastWordAutocomplete = (input) => {
  const searchText = input.value.toLowerCase();
  if (searchText === currentAuto.term && currentAuto.input === input) return;
  if (currentAuto.input !== input) currentAuto.focus = -1;
  currentAuto.input = input;
  currentAuto.term = searchText;
  clearAutocompleteItems();
  if (searchText === '') return;
  const searchResults = [
    ...new Set(
      wordList
        .filter((word) => word.startsWith(searchText))
        .concat(wordList.filter((word) => word.includes(searchText)))
    ),
  ].slice(0, 5);
  if (searchResults.length === 1 && searchResults[0] === searchText) {
    // user has found their word
    clearAutocompleteItems();
    calculateLastWord();
    return;
  }
  const resultsContainer = document.createElement('DIV');
  resultsContainer.setAttribute('class', 'autocomplete-items');
  document.body.appendChild(resultsContainer);
  autocompletePositionUpdate();
  searchResults.forEach((word) => {
    const resultDiv = document.createElement('DIV');
    resultDiv.innerHTML = word.replaceAll(
      searchText,
      `<strong>${searchText}</strong>`
    );
    resultDiv.dataset.word = word;
    resultDiv.addEventListener('click', function () {
      currentAuto.input.value = this.dataset.word;
      clearAutocompleteItems();
      focusOnNextWord();
    });
    resultsContainer.appendChild(resultDiv);
  });
  if (searchResults.length === 1) {
    currentAuto.focus = 0;
    addAutocompleteActive();
  }
};

const canLoadLastWordSeed = (bool) => {
  document.querySelector('#lastWordLoad').disabled = !bool;
};

const loadLastWordSeed = () => {
  const words = [...document.querySelectorAll('.lastWord-word')]
    .map((w) => w.value)
    .filter((w) => !!w)
    .join(' ');
  DOM.bip39Phrase.value = words;
  toast('Loading Seed...');
  mnemonicToSeedPopulate();
};

const autocompletePositionUpdate = () => {
  // check we have a list
  const autocompleteContainer = document.querySelector('.autocomplete-items');
  if (!autocompleteContainer || !currentAuto.input) return;
  const rect = currentAuto.input.getBoundingClientRect();
  // position the list
  autocompleteContainer.style.width = rect.width + 'px';
  autocompleteContainer.style.top = 3 + rect.bottom + scrollY + 'px';
  autocompleteContainer.style.left = rect.left + scrollX + 'px';
};

const keyPressAutocompleteHandler = (e) => {
  calculateLastWord();
  let suggestionList = document.querySelectorAll('.autocomplete-items>div');
  if (!suggestionList.length) {
    if (
      e.keyCode == 13 &&
      wordList.includes(normalizeString(currentAuto?.input?.value))
    ) {
      e.preventDefault();
      focusOnNextWord();
    }
    return;
  }
  if (e.keyCode == 40) {
    /*If the arrow DOWN key is pressed,
          increase the currentAuto.focus variable:*/
    currentAuto.focus++;
    /*and and make the current item more visible:*/
    addAutocompleteActive();
  } else if (e.keyCode == 38) {
    //up
    /*If the arrow UP key is pressed,
          decrease the currentAuto.focus variable:*/
    currentAuto.focus--;
    /*and and make the current item more visible:*/
    addAutocompleteActive();
  } else if (e.keyCode == 13) {
    /*If the ENTER key is pressed, prevent the form from being submitted,*/
    e.preventDefault();
    if (currentAuto.focus > -1) {
      /*and simulate a click on the "active" item:*/
      if (suggestionList) suggestionList[currentAuto.focus].click();
    }
  }
};

const addAutocompleteActive = () => {
  removeAutocompleteActive();
  const suggestions = document.querySelectorAll('.autocomplete-items>div');
  if (!suggestions || !suggestions.length) return;
  if (currentAuto.focus >= suggestions.length) currentAuto.focus = 0;
  if (currentAuto.focus < 0) currentAuto.focus = suggestions.length - 1;
  suggestions[currentAuto.focus].classList.add('autocomplete-active');
};

const removeAutocompleteActive = () => {
  document
    .querySelectorAll('.autocomplete-items>div')
    .forEach((div) => div.classList.remove('autocomplete-active'));
};

const focusOnNextWord = () => {
  const inputs = document.querySelectorAll('.' + currentAuto.input.className);
  const numWords = parseInt(
    currentAuto.input.className.startsWith('lastWord')
      ? DOM.lastWordLength.value
      : DOM.mnemonicLengthSelect.value
  );
  inputs.forEach((input, i) => {
    if (input === currentAuto.input && i + 1 < numWords) {
      inputs[i + 1].focus();
    }
  });
};

// bip39 Passphrase Test
const bip39PassphraseTest = async () => {
  let msg = '';
  const knownAddress = normalizeString(
    document.getElementById('bip39KnownAddr').value
  );
  const userPath = document.getElementById('bip39CustomPath').value.trim();
  if (userPath.match(/^(m\/)?(\d+'?\/)*\d+'?$/) === null) {
    bip39PassphraseMessage(
      'ERROR: This path is invalid, please check it and try again'
    );
    toast('Invalid Path');
    return;
  }
  if (!bip32RootKey || !knownAddress || !userPath) {
    bip39PassphraseMessage(
      'ERROR: You will need a valid seed, known address and path'
    );
    toast('Some info missing');
    return;
  }
  const pathBip = 'bip' + parseInt(userPath.split('/')[1]);
  switch (pathBip) {
    case 'bip0':
    case 'bip44':
      if (!knownAddress.startsWith('1')) {
        msg =
          'ERROR: Your path indicates a legacy address, but your address doesn\'t start with "1"';
        bip39PassphraseMessage(msg);
        toast('Incorrect path');
        return;
      }
      break;
    case 'bip49':
      if (!knownAddress.startsWith('3')) {
        msg =
          'ERROR: Your path indicates a wrapped segwit address, but your address doesn\'t start with "3"';
        bip39PassphraseMessage(msg);
        toast('Incorrect path');
        return;
      }
      break;
    case 'bip84':
      if (!knownAddress.startsWith('bc1q')) {
        msg =
          'ERROR: Your path indicates a native segwit address, but your address doesn\'t start with "bc1q"';
        bip39PassphraseMessage(msg);
        toast('Incorrect path');
        return;
      }
      break;
    default:
      break;
  }
  document.querySelector('#loadingPage>h2').innerText = 'searching...';
  document.getElementById('loadingPage').style.display = '';
  await sleep(50);
  try {
    const node = bip32RootKey;
    const path = (i) => `${userPath}/${i}`;
    for (let i = 0; i < 1000; i++) {
      const addressPath = path(i);
      const addressNode = node.derivePath(addressPath);
      const address = getAddress(addressNode, pathBip);
      if (address === knownAddress) {
        msg = /*html*/ `<strong>SUCCESS: </strong>Address at index ${i} matches your address!`;
        bip39PassphraseMessage(msg);
        toast('MATCH FOUND!!!');
        return;
      }
      if (address[0] !== knownAddress[0]) {
        throw new Error(
          `INCORRECT PATH: Generated Address ${address} is of a different type to user address ${knownAddress}`
        );
      }
    }
  } catch (error) {
    msg = 'ERROR: ' + error?.message || error;
    bip39PassphraseMessage(msg);
    console.error(error?.message || error);
    toast('Error!');
    return;
  }
  msg = /*html*/ `Your address did not match after searching 1000 addresses derived from this path and seed.`;
  bip39PassphraseMessage(msg);
  toast('No Match Found');
};

const bip39PassphraseMessage = (msg) => {
  const msgEl = document.getElementById('bip39PassTestInfo');
  msgEl.innerHTML = msg;
  document.getElementById('loadingPage').style.display = 'none';
  adjustPanelHeight();
};

// Remove XOR seed
const removeXorSeed = async (event) => {
  event.preventDefault();
  document.getElementById('xorAddSeed').disabled = false;
  const seeds = [...document.querySelectorAll('.xor-seed')];
  let visibleSeeds = 0;
  for (let i = seeds.length - 1; i > 0; i--) {
    visibleSeeds = i;
    const seed = seeds[i];
    if (!seed.classList.contains('hidden')) {
      seed.classList.add('hidden');
      break;
    }
  }
  visibleSeeds++;
  document
    .querySelectorAll('.xor-number-seeds')
    .forEach((span) => (span.innerText = visibleSeeds));
  document.getElementById('xorRemoveSeed').disabled =
    visibleSeeds === 2 ? true : false;
  await calculateXor();
  adjustPanelHeight();
};

// Add an xor seed
const addXorSeed = async (event) => {
  event.preventDefault();
  document.getElementById('xorRemoveSeed').disabled = false;
  const seeds = [...document.querySelectorAll('.xor-seed')];
  let visibleSeeds = 0;
  for (let i = 0; i < seeds.length; i++) {
    visibleSeeds = i;
    const seed = seeds[i];
    if (seed.classList.contains('hidden')) {
      seed.classList.remove('hidden');
      break;
    }
  }
  visibleSeeds += 2;
  document
    .querySelectorAll('.xor-number-seeds')
    .forEach((span) => (span.innerText = visibleSeeds));
  document.getElementById('xorAddSeed').disabled =
    visibleSeeds === 8 ? true : false;
  await calculateXor();
  adjustPanelHeight();
};

/**
 * Converts an array of bytes to a binary string
 * @param {number[]} byteArray
 * @returns {string}
 */
const bytesToBinary = (byteArray) =>
  byteArray.map((x) => x.toString(2).padStart(8, '0')).join('');

const deriveChecksumBits = async (entropyBuffer) => {
  const ENT = entropyBuffer.length * 8;
  const CS = ENT / 32;
  const hash = await crypto.subtle.digest('SHA-256', entropyBuffer);
  return bytesToBinary([...new Uint8Array(hash)]).slice(0, CS);
};

const showXorQr = (ev) => {
  let phrase = '';
  if (ev.id === 'qrXorResult') {
    phrase = document.getElementById('xorResult').value;
  } else {
    //qrXor
    phrase = document.getElementById(
      `xorSeed${ev.id.replace('qrXor', '')}`
    ).value;
  }
  if (!bip39.validateMnemonic(phrase)) return;
  openQrModal(phraseToCompactQrBytes(phrase), phrase);
};

// Calculate XOR
const calculateXor = async () => {
  let result = getWordIndexes(phraseToWordArray());
  const seeds = [...document.querySelectorAll('.xor-seed')]
    .filter((div) => !div.classList.contains('hidden'))
    .map((div) =>
      getWordIndexes(phraseToWordArray(div.querySelector('textarea').value))
    );
  if (seeds.length < 1) {
    console.error('Not enough seeds to do XOR');
    return;
  }
  for (let i = 0; i < seeds.length; i++) {
    if (seeds[i].length === 0) {
      console.error("Can't do XOR on empty seed");
      return;
    }
  }
  seeds.forEach((seedToXor) => {
    result = result.map((wordInd, i) => {
      return wordInd ^ seedToXor[i];
    });
  });
  const bits = result.map((x) => x.toString(2).padStart(11, '0')).join('');
  const dividerIndex = Math.floor(bits.length / 33) * 32;
  const entropyBits = bits.slice(0, dividerIndex);
  const entropyBytes = entropyBits
    .match(/(.{1,8})/g)
    .map((bin) => parseInt(bin, 2));
  if (
    entropyBytes.length < 16 ||
    entropyBytes.length > 32 ||
    entropyBytes.length % 4 !== 0
  ) {
    console.error('Invalid entropy');
    return;
  }
  const entropy = Uint8Array.from(entropyBytes);
  const newChecksum = await deriveChecksumBits(entropy);
  let newLastWordIndex = parseInt(
    result
      .pop()
      .toString(2)
      .padStart(11, '0')
      .slice(0, 11 - newChecksum.length) + newChecksum,
    2
  );
  result.push(newLastWordIndex);
  result = result.map((n) => wordList[n]);
  document.getElementById('xorResult').value = result.join(' ');
};

const fillRandomXorSeeds = () => {
  document.querySelectorAll('.xor-seed').forEach((div) => {
    div.querySelector('textarea').value = createMnemonic();
  });
};

// Generate OTP
const generateOneTimePad = async () => {
  const strength = parseInt(DOM.generateRandomStrengthSelect.value);
  key = await otp.generate(strength);
  document.getElementById('otpKey').value = key;
  return key;
};

// Encrypt OTP
const encryptOneTimePad = async () => {
  const mnemonic = getPhrase();
  if (!bip39.validateMnemonic(mnemonic)) return;
  const strength = parseInt(DOM.generateRandomStrengthSelect.value);
  let key = document.getElementById('otpKey').value;
  const keyValid = await otp.validateKey(key, strength);
  if (!keyValid) {
    toast('Invalid OTP Key');
    return;
  }
  if (!key) {
    key = await generateOneTimePad();
  }
  const cipherMnemonic = await otp.encrypt(key, mnemonic);
  document.getElementById('otpCipherText').value = cipherMnemonic;
};

// Decrypt OTP
const decryptOneTimePad = async () => {
  const cipherMnemonic = normalizeString(
    document.getElementById('otpCipherText').value
  );
  const key = normalizeString(document.getElementById('otpKey').value);
  if (!cipherMnemonic || !key) return;
  const mnemonic = await otp.decrypt(key, cipherMnemonic);
  document.getElementById('otpDecrypted').value = mnemonic;
  const loadedMnemonic = getPhrase();
  if (loadedMnemonic)
    document.getElementById('otpMatched').innerHTML =
      mnemonic === loadedMnemonic
        ? 'Matches the loaded seed'
        : '<span class="warning">ERROR: Does not match the loaded seed</span>';
  adjustPanelHeight();
};

// adjust textarea rows/height
function textareaResize() {
  document.querySelectorAll('textarea').forEach((textareaElement) => {
    textareaElement.style.width = '100%';
    textareaElement.style.height = 'auto';
    textareaElement.style.height = textareaElement.scrollHeight + 5 + 'px';
  });
}

// Make adjustments to the layout if the window size changes
const resizeObserver = new ResizeObserver(() => {
  if (lastInnerWidth === innerWidth) return;
  adjustPanelHeight();
});

// QR Code icon
const addQRIcon = (element, data, seedPhrase) => {
  while (element.firstChild) {
    element.removeChild(element.lastChild);
  }
  const template = document.getElementById('qrTemplate');
  const clone = template.content.firstElementChild.cloneNode(true);
  clone.addEventListener('click', () => {
    openQrModal(data, seedPhrase);
  });
  clone.style.display = hidePrivateData ? 'none' : '';
  element.append(clone);
};

// Add Copy Buttons
const setupCopyButton = (element) => {
  const template = document.getElementById('copyButtonTemplate');
  const clone = template.content.firstElementChild.cloneNode(true);

  element.addEventListener('mouseenter', () => {
    clone.classList.remove('hidden');
  });
  element.addEventListener('mouseleave', () => {
    clone.classList.add('hidden');
  });
  clone.addEventListener('click', () => {
    const textarea = element.querySelector('.textarea-input');
    const text = normalizeString(textarea.value);
    copyTextToClipboard(text);
  });
  element.appendChild(clone);
};

// for one click copy
const copyEventHandler = (event) => {
  event.preventDefault();
  const textElement = event.currentTarget;
  const text = textElement.value || textElement.innerText;
  copyTextToClipboard(text);
};

// BIP47 functions
// Show/Hide paynym sections
const togglePaynym = () => {
  DOM.bip47PaynymSections.forEach((element) => {
    if (DOM.bip47UsePaynym.checked) {
      element.classList.remove('hidden');
    } else {
      element.classList.add('hidden');
    }
  });
  fetchRobotImages();
};

// Use paynym.is robohash api to get a robot image
const fetchRobotImages = async () => {
  const url = 'https://paynym.is/preview/';
  const myPayCode = normalizeString(DOM.bip47MyPaymentCode.value);
  const bobPayCode = normalizeString(DOM.bip47CPPaymentCode.value);
  // Only if user wants it and there is at least one payment code
  if (!DOM.bip47UsePaynym.checked || !myPayCode) return;
  // wrap in try catch in case offline
  try {
    if (window.navigator.onLine) {
      // remove any old robot images if they exist and add new ones
      DOM.bip47PaynymSections.forEach((element) => {
        while (element.firstChild) {
          element.removeChild(element.firstChild);
        }
        const robotUrl =
          url + (element.id === 'bip47MyRobotSection' ? myPayCode : bobPayCode);
        // don't add an image without a payCode
        if (robotUrl.length > url.length) {
          const img = document.createElement('img');
          img.src = robotUrl;
          img.className = 'bip47-robot';
          img.style.height = '300px';
          element.appendChild(img);
        }
      });
    } else {
      // remove robot images if they exist and add text explaining why
      DOM.bip47PaynymSections.forEach((element) => {
        while (element.firstChild) {
          element.removeChild(element.firstChild);
        }
        element.innerText = 'Unable to display a Robot, you may be offline.';
      });
    }
  } catch (error) {
    console.error(error); // TODO remove this for prod?
    // remove robot images if they exist and add text explaining why
    DOM.bip47PaynymSections.forEach((element) => {
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
      element.innerText = 'Unable to display a Robot, you may be offline.';
    });
  }
  adjustPanelHeight();
};

// Calculate and populate User's bip47 fields
const calcBip47 = () => {
  // make sure we have a valid seed and mnemonic
  if (!getPhrase() || !bip32RootKey) return;
  const mySeed = bip39.mnemonicToSeedSync(getPhrase(), getPassphrase());
  const myNetwork = bip47.utils.networks[DOM.bip47Network.value];
  myPayCode = bip47.fromWalletSeed(mySeed, 0, myNetwork);
  const myNotify = myPayCode.derive(0);
  const myPrvKey = myNotify.privateKey;
  const myPubKey = myNotify.publicKey;
  const myNotificationAddress = myPayCode.getNotificationAddress();
  const myWIF = bitcoin.ECPair.fromPrivateKey(myPrvKey, {
    network: myNetwork,
  }).toWIF();
  DOM.bip47MyPaymentCode.value = myPayCode.toBase58();
  DOM.bip47MyNotificationAddress.value = myNotificationAddress;
  DOM.bip47MyNotificationPrvKey.value = myWIF;
  DOM.bip47MyNotificationPubKey.value = myPubKey.toString('hex');
  fetchRobotImages();
  addQRIcon(
    document.getElementById('bip47MyPaymentCodeQR'),
    `bitcoin:${myPayCode.toBase58()}`
  );
  addQRIcon(
    document.getElementById('bip47MyNotificationAddressQR'),
    myNotificationAddress
  );
};

/**
 * Test if a payment code is valid
 * @param {string} paymentCode Base58 encoded string of the payment code
 * @returns {boolean}
 */
const isValidPaymentCode = (paymentCode) => {
  try {
    bip47.fromBase58(paymentCode, bip47.utils.networks[DOM.bip47Network.value]);
    return true;
  } catch (_error) {
    return false;
  }
};
// Calculate and populate counter-party's bip47 fields
const calcBip47CounterParty = () => {
  // Test it is valid
  const bobPcBase58 = normalizeString(DOM.bip47CPPaymentCode.value);
  if (!isValidPaymentCode(bobPcBase58)) {
    DOM.bip47CPGenSection.classList.add('hidden');
    adjustPanelHeight();
    return;
  }
  DOM.bip47CPGenSection.classList.remove('hidden');
  bobPayCode = bip47.fromBase58(
    bobPcBase58,
    bip47.utils.networks[DOM.bip47Network.value]
  );
  const bobNotifyPubKey = bobPayCode.derive(0).publicKey;
  const bobNotifyAddress = bobPayCode.getNotificationAddress();
  DOM.bip47CPNotificationAddress.value = bobNotifyAddress;
  DOM.bip47CPNotificationPubKey.value = bobNotifyPubKey.toString('hex');
  calculateBip47Addresses();
  adjustPanelHeight();
  fetchRobotImages();
  addQRIcon(
    document.getElementById('bip47CPPaymentCodeQR'),
    `bitcoin:${bobPcBase58}`
  );
  addQRIcon(
    document.getElementById('bip47CPNotificationAddressQR'),
    bobNotifyAddress
  );
};

// Remove data from bip47 section
const clearBip47Addresses = () => {
  DOM.bip47CsvDownloadLink.classList.add('hidden');
  while (DOM.bip47AddressListContainer.firstChild) {
    DOM.bip47AddressListContainer.removeChild(
      DOM.bip47AddressListContainer.firstChild
    );
  }
  adjustPanelHeight();
  fetchRobotImages();
};

// generates an array of addresses and passes them on to be displayed
const calculateBip47Addresses = () => {
  clearBip47Addresses();
  DOM.bip47AddressSection.classList.add('hidden');

  if (
    !DOM.bip47MyNotificationAddress.value ||
    !DOM.bip47CPNotificationAddress.value
  ) {
    return;
  }
  // We have both notification addresses so the codes are valid
  DOM.bip47AddressSection.classList.remove('hidden');
  const addressType = DOM.bip47AddressType.value;
  const sendReceive = DOM.bip47SendReceive.value;
  const startIndex = parseInt(DOM.bip47StartIndex.value);
  const endIndex = startIndex + parseInt(DOM.bip47NoOfAddresses.value);
  try {
    const addressDataArray = [];
    for (let i = startIndex; i < endIndex; i++) {
      const addressPath = `BIP47_${addressType}_${sendReceive.toUpperCase()}_${i}`;
      let pCode,
        key,
        prvKey = null;
      if (sendReceive === 'send') {
        // Derive from counter party payment code
        pCode = bobPayCode;
        key = myPayCode.derive(0).privateKey;
      } else {
        // Derive from my payment code
        pCode = myPayCode;
        key = bobPayCode.derive(0).publicKey;
        prvKey = bitcoin.ECPair.fromPrivateKey(
          pCode.derivePaymentPrivateKey(key, i)
        ).toWIF();
      }
      const payPubKey = pCode.derivePaymentPublicKey(key, i);
      let address;
      const network47 = bip47.utils.networks[DOM.bip47Network.value];
      switch (addressType) {
        case 'P2PKH':
          address = bitcoin.payments.p2pkh({
            pubkey: payPubKey,
            network: network47,
          }).address;
          break;
        case 'P2WPKH':
          address = bitcoin.payments.p2wpkh({
            pubkey: payPubKey,
            network: network47,
          }).address;
          break;
        case 'P2WPKH/P2SH':
          address = bitcoin.payments.p2sh({
            redeem: bitcoin.payments.p2wpkh({
              pubkey: payPubKey,
              network: network47,
            }),
            network: network47,
          }).address;
          break;
        default:
          address = '';
          break;
      }
      addressDataArray[i] = new AddressData(
        addressPath,
        address,
        payPubKey.toString('hex'),
        prvKey
      );
    }
    injectAddresses(
      addressDataArray,
      DOM.bip47CsvDownloadLink,
      DOM.bip47AddressListContainer
    );
  } catch (error) {
    console.error(error?.message || error);
    console.error(error);
  }
};

// returns addresses for a given node depending on currentBip
const getAddress = (node, bipToUse = currentBip) => {
  if (bipToUse === 'bip49') {
    return bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({
        pubkey: node.publicKey,
        network,
      }),
      network,
    }).address;
  }
  if (bipToUse === 'bip84') {
    return bitcoin.payments.p2wpkh({
      pubkey: node.publicKey,
      network,
    }).address;
  }
  return bitcoin.payments.p2pkh({ pubkey: node.publicKey, network }).address;
};

/**
 * Debounce - from Underscore.js
 * @param {function} func The function to debounce
 * @param {number} wait Number of ms to wait
 * @param {boolean} immediate Override timeout and call now
 * @returns {function}
 */
// Returns a function, that, as long as it continues to be invoked,
// will not be triggered. The function will be called after it
// stops being called for N milliseconds. If `immediate` is passed,
// trigger the function on the leading edge, instead of the trailing.
function debounce(func, wait, immediate) {
  let timeout;
  return function () {
    const context = this,
      args = arguments;
    const later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

// Event handler for switching tabs
window.tabSelect = (event, tabId) => {
  DOM.allTabContents.forEach((contentElement) => {
    contentElement.style.display = 'none';
  });
  DOM.allTabLinks.forEach((tabLink) => {
    tabLink.classList.remove('tab--active');
  });
  document.getElementById(tabId).style.display = 'block';
  event.currentTarget.classList.add('tab--active');
  // make seed phrase read only if inputting own entropy
  if (tabId === 'Input_Entropy') {
    DOM.bip39Phrase.setAttribute('readonly', 'true');
  } else {
    DOM.bip39Phrase.removeAttribute('readonly');
  }
  adjustPanelHeight();
};
// Event handler for switching bips
const derivedPathSelectChanged = (event) => {
  const bip = DOM.derivedPathSelect.value;
  if (currentBip === bip) return;
  currentBip = bip;
  DOM.allBipsContents.forEach((element) => element.classList.add('hidden'));
  DOM.bip141ScriptSelectDiv.classList.add('hidden');
  DOM.pathInputSection.classList.remove('hidden');
  DOM.path.readOnly = true;
  if (bip !== 'custom') {
    document.getElementById(bip + 'AddressSection')?.classList.remove('hidden');
  }
  if (bip === 'custom') {
    // hide everything and make the path editable
    DOM.path.readOnly = false;
    DOM.pathInputSection.classList.add('hidden');
  } else if (bip === 'bip32') {
    DOM.pathInputSection.classList.add('hidden');
    DOM.path.value = `m/0'/0'`;
    DOM.addressGenerateButton.click();
  } else if (bip === 'bip141') {
    DOM.bip141ScriptSelectDiv.classList.remove('hidden');
    DOM.pathInputSection.classList.add('hidden');
    DOM.path.readOnly = false;
  } else {
    DOM.pathPurpose.value = bip.slice(3);
    document.getElementById('pathBipText').innerText = bip.toUpperCase();
    changePath();
  }
  adjustPanelHeight();
};
/**
 * QnA Explains dialog / Modal
 */

/**
 * Hide the modal and clear it's text
 */
const clearInfoModal = () => {
  DOM.infoModal.style.display = 'none';
  DOM.infoModalText.innerHTML = '';
};
/**
 * Open the QnA Explains dialog
 * @param {Event} _event Not used
 * @param {string} section string for the key to get value from info.js
 */
window.openInfoModal = (_event, section) => {
  DOM.infoModalText.innerHTML = window.infoHtml[section];
  DOM.infoModal.style.display = 'block';
};
/**
 * Function to close the dialog when user clicks on the outside
 * @param {Event} event Click Event on area outside the dialog
 */
window.onclick = function (event) {
  if (event.target === DOM.infoModal) {
    clearInfoModal();
  }
};
/**
 * SeedQR
 */
(() => {
  [...document.querySelectorAll('.xorQrIcon')].forEach((span) => {
    const template = document.getElementById('qrTemplate');
    const clone = template.content.firstElementChild.cloneNode(true);
    clone.style.display = hidePrivateData ? 'none' : '';
    span.append(clone);
  });
})();
const clearCompactSeedQR = () => {
  const el = document.getElementById('compactSeedQR');
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
};
const phraseToCompactQrBytes = (phrase) =>
  JSON.stringify(
    phrase
      .split(' ')
      .map((word) => wordList.indexOf(word).toString(2).padStart(11, '0'))
      .join('')
      .match(/[01]{8}/g)
      .map((bin) => parseInt(bin, 2))
      .slice(0, (parseInt(phrase.split(' ').length) * 32) / 3 / 8)
  );
const makeCompactSeedQR = () => {
  clearCompactSeedQR();
  const phrase = getPhrase();
  if (!bip39.validateMnemonic(phrase)) return;
  addQRIcon(
    document.getElementById('compactSeedQR'),
    phraseToCompactQrBytes(phrase),
    phrase
  );
};
/**
 * QR dialog / Modal
 */

/**
 * Hide the modal and clear it's text
 */
const clearQRModal = () => {
  DOM.qrModal.style.display = 'none';
  DOM.qrModalDiv.innerHTML = '';
};
const openQrModal = (dataString, seedPhrase = '') => {
  clearQRModal();
  const qr = new QRCode(0, 'L');
  qr.addData(dataString);
  qr.make();
  const cellSize = seedPhrase.split(' ').length === 12 ? 17 : 15;
  const qrSvg = qr.createSvgTag({
    cellSize,
    scalable: true,
  });
  if (seedPhrase) {
    const fp = bip32
      .fromSeed(bip39.mnemonicToSeedSync(seedPhrase))
      .fingerprint.toString('hex');
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    const ctx = canvas.getContext('2d');
    canvas.id = 'seedQRCanvas';
    canvas.setAttribute('height', 600);
    canvas.setAttribute('width', 500);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);
    ctx.fillStyle = '#000';
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Fingerprint: ${fp}`, canvas.width / 2, 45);
    ctx.fillText(`Notes:`, canvas.width / 2, 460);
    const qrCode = new Image();
    qrCode.addEventListener(
      'load',
      () => {
        ctx.drawImage(qrCode, 0, 100, 500, 500);
        qrCode.remove();
      },
      false
    );
    const regex = /<path d="([^]*?) "/gim;
    const arr = regex.exec(qrSvg);
    ctx.fillStyle = '#000';
    ctx.fill(new Path2D(arr[1]));
    DOM.qrModalDiv.appendChild(canvas);
    // DOM.qrModalDiv.appendChild(qrCode);
  } else {
    DOM.qrModalDiv.innerHTML = qrSvg;
  }
  DOM.qrModal.style.display = 'block';
  DOM.qrModalDiv.style.display = 'block';
};
/**
 * Function to close the dialog when user clicks on the outside
 * @param {Event} event Click Event on area outside the dialog
 */
window.onclick = function (event) {
  if (event.target === DOM.qrModal) {
    clearQRModal();
  }
};
/**
 * Copy text to clipboard
 * @param {string} text text to copy
 */
function copyTextToClipboard(text) {
  navigator.clipboard.writeText(text).then(
    function () {
      toast('Copied to clipboard');
    },
    function (err) {
      console.error('Async: Could not copy text: ', err);
      toast('ERROR: Unable to copy to clipboard');
    }
  );
}
/**
 * Displays a pop-up message like a notification
 * @param {string} message Message to display in notification toast
 */
function toast(message) {
  DOM.toastMessage.innerText = message || 'ERROR: Unknown Message';
  DOM.toastMessage.classList.add('show-toast');
  const background = document.getElementById('toast-background');
  background.classList.add('show-toast');
  setTimeout(() => {
    DOM.toastMessage.classList.remove('show-toast');
    background.classList.remove('show-toast');
  }, 3000);
}

// resizes layout of panels in accordion and textarea boxes
// debounce as this gets called a lot
const adjustPanelHeight = debounce(() => {
  textareaResize();
  DOM.accordionPanels.forEach((panel) => {
    panel.style.maxHeight = panel.classList.contains('accordion-panel--active')
      ? panel.scrollHeight + 'px'
      : null;
  });
}, 50);

// event handler for when the path is changed
const changePath = () => {
  const purpose = DOM.pathPurpose.value;
  const coin = DOM.pathCoin.value;
  const account = DOM.pathAccount.value;
  const change = DOM.pathChange.value;
  isTestnet = coin === '1';
  DOM.path.value = `m/${purpose}'/${coin}'/${account}'/${change}`;
  fillBip32Keys();
  calculateAddresses();
};
/**
 * Class representing address data
 * Used to populate address lists
 */
class AddressData {
  /**
   * Create an AddressData object.
   * @param {string} path - The path used to generate the address.
   * @param {string} address - The address.
   * @param {string=} pubKey - The public key.
   * @param {string=} prvKey - The private key.
   */
  constructor(path, address, pubKey, prvKey) {
    this.path = path;
    this.address = address;
    this.pubKey = pubKey || '';
    this.prvKey = prvKey || '';
  }
}
/**
 * Injects address data into the assigned address list
 * @param {AddressData[]} addressDataArray - an array of AddressData objects.
 * @param {string} addressListName - a string saying which address list to populate. e.g. 'bip32'
 */
const injectAddresses = (addressDataArray, csvLink, addressDiv) => {
  // Init the csv string with the headers
  let csv = `path,address,public key,private key
  `;
  // declare DOM elements
  csvLink.classList.remove('hidden');
  const template = document.querySelector('#addressTemplate');
  // Ensure not internet explorer!
  if (!('content' in document.createElement('template'))) {
    throw new Error(
      'Browser Outdated! Unable to populate list and generate csv.'
    );
  }
  addressDataArray.forEach((addressData) => {
    // Append this address to csv
    csv += `${addressData.path},${addressData.address},${
      addressData.pubKey || 'N/A'
    },${addressData.prvKey || 'N/A'},
  `;
    // clone the address list template HTML
    const clone = template.content.firstElementChild.cloneNode(true);
    // Insert the path, address, public key & private key into the clone
    for (const data in addressData) {
      if (Object.hasOwnProperty.call(addressData, data)) {
        const span = clone.querySelector(`.address-details--${data}`);
        if (!addressData[data]) {
          span.parentElement.classList.add('hidden');
        } else {
          span.parentElement.classList.remove('hidden');
          span.innerText = addressData[data];
          if (data === 'address') {
            addQRIcon(
              clone.querySelector('.qr-button-holder'),
              addressData[data]
            );
          }
        }
      }
    }
    // Add the clone to the DOM
    addressDiv.appendChild(clone);
  });
  if (hidePrivateData) {
    hidePrivateData = false;
    toggleHideAllPrivateData();
  }
  csvLink.href = `data:text/csv;charset=utf-8,${encodeURI(csv)}`;
  adjustPanelHeight();
};

// get derived addresses and pass them off to be inserted in DOM
const calculateAddresses = (startIndex = 0, endIndex = 19) => {
  clearAddresses();
  if (!bip32RootKey) {
    return;
  }
  if (currentBip === 'bip86') {
    calculateBip86Addresses(startIndex, endIndex);
    return;
  }
  try {
    const node = bip32RootKey;
    const path = (i) => `${DOM.path.value}/${i}`;
    const addressDataArray = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const addressPath = path(i);
      const addressNode = node.derivePath(addressPath);
      const address = getAddress(addressNode);
      const addressPubKey = addressNode.publicKey.toString('hex');
      const addressPrivKey = bitcoin.ECPair.fromPrivateKey(
        addressNode.privateKey,
        {
          network: network,
        }
      ).toWIF();
      addressDataArray[i] = new AddressData(
        addressPath,
        address,
        addressPubKey,
        addressPrivKey
      );
    }
    injectAddresses(
      addressDataArray,
      DOM.csvDownloadLink,
      DOM.addressListContainer
    );
  } catch (error) {
    console.error(error?.message || error);
  }
};

// get derived addresses and pass them off to be inserted in DOM
const calculateBip86Addresses = (startIndex = 0, endIndex = 19) => {
  clearAddresses();
  if (!bip32RootKey) {
    return;
  }
  try {
    const mnemonic = getPhrase();
    const accountNumber = parseInt(DOM.pathAccount.value);
    const root86 = new bip86.fromMnemonic(mnemonic, getPassphrase(), isTestnet);
    const child86 = root86.deriveAccount(accountNumber);
    const account86 = new bip86.fromXPrv(child86);
    const isChange = !!parseInt(DOM.pathChange.value);
    const path = (i) => `${DOM.path.value}/${i}`;
    const addressDataArray = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const addressPath = path(i);
      const address = account86.getAddress(i, isChange);
      const addressPubKey = account86.getPublicKey(i, isChange);
      const addressPrivKey = account86.getPrivateKey(i, isChange);
      addressDataArray[i] = new AddressData(
        addressPath,
        address,
        addressPubKey,
        addressPrivKey
      );
    }
    injectAddresses(
      addressDataArray,
      DOM.csvDownloadLink,
      DOM.addressListContainer
    );
  } catch (error) {
    console.error(error?.message || error);
  }
};

// Handler for when derived addresses need doing
const generateAddresses = (event) => {
  event.preventDefault();
  const btn = event.target;
  const parentEl = btn.parentElement;
  const startIndex =
    parseInt(parentEl.querySelector('.address-start-index')?.value) || 0;
  const endIndex =
    parseInt(parentEl.querySelector('.address-end-index')?.value) || 19;
  calculateAddresses(startIndex, endIndex);
  fillBip32Keys();
};

// Remove displayed derived addresses
const clearAddresses = () => {
  DOM.csvDownloadLink.classList.add('hidden');
  while (DOM.addressListContainer.firstChild) {
    DOM.addressListContainer.removeChild(DOM.addressListContainer.firstChild);
  }
  adjustPanelHeight();
};

// Populate extended keys for currentBip
const fillBip32Keys = () => {
  if (!bip32RootKey) return;
  if (currentBip === 'bip49' || currentBip === 'bip84') {
    if (isTestnet) {
      network = networks.testnet[currentBip];
      bip32RootKey.network = networks.testnet[currentBip];
    } else {
      network = networks.bitcoin[currentBip];
      bip32RootKey.network = networks.bitcoin[currentBip];
    }
  } else {
    if (isTestnet) {
      network = bitcoin.networks.testnet;
      bip32RootKey.network = bitcoin.networks.testnet;
    } else {
      network = bitcoin.networks.bitcoin;
      bip32RootKey.network = bitcoin.networks.bitcoin;
    }
  }
  bip32ExtendedKey = bip32RootKey.derivePath(DOM.path.value);
  DOM.bip32AccountXprv.value = bip32ExtendedKey.toBase58();
  const xpub = bip32ExtendedKey.neutered().toBase58();
  DOM.bip32AccountXpub.value = xpub;
  addQRIcon(document.getElementById('bip32AccountXpubQR'), xpub);
  if (currentBip !== 'bip32') {
    displayAccountKeys();
  }
  fillMultisigYZ();
};

// Multisig Ypub & Zpub
const fillMultisigYZ = () => {
  const Zpub = bip32RootKey.derivePath(`m/48'/0'/0'/2'`).neutered().toBase58();
  let dataZ = bs58check.decode(Zpub);
  dataZ = dataZ.slice(4);
  const Z = bs58check.encode(
    Buffer.Buffer.concat([Buffer.Buffer.from('02aa7ed3', 'hex'), dataZ])
  );
  document.getElementById('myZpub').value = Z;
  const Ypub = bip32RootKey.derivePath(`m/48'/0'/0'/1'`).neutered().toBase58();
  let dataY = bs58check.decode(Ypub);
  dataY = dataY.slice(4);
  const Y = bs58check.encode(
    Buffer.Buffer.concat([Buffer.Buffer.from('0295b43f', 'hex'), dataY])
  );
  document.getElementById('myYpub').value = Y;
  addQRIcon(document.querySelector('#myZpubQR'), Z);
  addQRIcon(document.querySelector('#myYpubQR'), Y);
};

// When currentBip isn't 32, display bip32 keys
const displayAccountKeys = () => {
  const purpose = DOM.pathPurpose.value;
  const coin = DOM.pathCoin.value;
  const account = DOM.pathAccount.value;
  const accountPath = `m/${purpose}'/${coin}'/${account}'`;
  const accountExtendedKey = bip32RootKey.derivePath(accountPath);
  DOM.pathAccountXprv.value = accountExtendedKey.toBase58();
  const xpub = accountExtendedKey.neutered().toBase58();
  DOM.pathAccountXpub.value = xpub;
  addQRIcon(document.getElementById('pathAccountXpubQR'), xpub);
};

// Calculate and populate the BIP85 section
const calcBip85 = async () => {
  const app = DOM.bip85Application.value;
  DOM.bip85MnemonicLength.parentElement.classList.add('hidden');
  DOM.bip85Bytes.parentElement.classList.add('hidden');
  if (app === 'bip39') {
    DOM.bip85MnemonicLength.parentElement.classList.remove('hidden');
  } else if (app === 'hex') {
    DOM.bip85Bytes.parentElement.classList.remove('hidden');
  }
  const rootKeyBase58 = DOM.bip32RootKey.value;
  if (!rootKeyBase58) {
    return;
  }
  try {
    const master = bip85.BIP85.fromBase58(rootKeyBase58);
    const index = parseInt(DOM.bip85Index.value);
    const length = parseInt(DOM.bip85MnemonicLength.value);
    const bytes = parseInt(DOM.bip85Bytes.value);

    // Generate child keys for 5 consecutive indices
    for (let i = 0; i < 5; i++) {
      let result;
      if (app === 'bip39') {
        result = master.deriveBIP39(0, length, index + i).toMnemonic();
      } else if (app === 'wif') {
        result = master.deriveWIF(index + i).toWIF();
      } else if (app === 'xprv') {
        result = master.deriveXPRV(index + i).toXPRV();
      } else if (app === 'hex') {
        result = master.deriveHex(bytes, index + i).toEntropy();
      }
      DOM[`bip85ChildKey${i}`].value = result;

      // Update the index span for each field
      document.querySelectorAll('.bip85IndexSpan')[i].textContent = index + i;
    }

    adjustPanelHeight();
  } catch (e) {
    toast('BIP85: ' + e.message);
    console.error('BIP85: ' + e.message);
    // Clear all child key fields on error
    for (let i = 0; i < 5; i++) {
      DOM[`bip85ChildKey${i}`].value = '';
    }
  }
};

// Function to load a specific child key
const bip85LoadSpecificChild = (childIndex) => {
  // Save current key as parent
  const phrase = getPhrase();
  const passphrase = getPassphrase();
  if (!phrase) {
    toast('Current Mnemonic not found');
    return;
  }
  bip85Lineage.push({ phrase, passphrase });
  // Enable load parent btn
  if (DOM.bip85LoadParent.disabled) {
    DOM.bip85LoadParent.disabled = false;
    DOM.bip85LoadParent.title = 'Load the parent key back into the tool';
  }
  // Load child
  const childKey = DOM[`bip85ChildKey${childIndex}`].value;
  DOM.bip39Phrase.value = childKey;
  toast('Loading Child Seed...');
  mnemonicToSeedPopulate();
};

// Return to the parent of the current seed, if one exists
const bip85LoadParent = (event) => {
  event.preventDefault();
  // check there is a parent
  if (!bip85Lineage.length) {
    DOM.bip85LoadParent.disabled = true;
    DOM.bip85LoadParent.title = 'No parent key to load';
    toast('No Parent available');
    return;
  }
  const parent = bip85Lineage.pop();
  DOM.bip39Phrase.value = parent.phrase;
  DOM.bip39Passphrase.value = parent.passphrase;
  toast('Loading Parent Seed...');
  mnemonicToSeedPopulate();
  if (!bip85Lineage.length) {
    DOM.bip85LoadParent.disabled = true;
    DOM.bip85LoadParent.title = 'No parent key to load';
  }
};

// Load the bip85 child seed into the tool and save the parent
const bip85LoadChild = (event) => {
  event.preventDefault();
  // Save current key as parent
  const phrase = getPhrase();
  const passphrase = getPassphrase();
  if (!phrase) {
    toast('Current Mnemonic not found');
    return;
  }
  bip85Lineage.push({ phrase, passphrase });
  // Enable load parent btn
  if (DOM.bip85LoadParent.disabled) {
    DOM.bip85LoadParent.disabled = false;
    DOM.bip85LoadParent.title = 'Load the parent key back into the tool';
  }
  //load child
  const rootKeyBase58 = DOM.bip32RootKey.value;
  const master = bip85.BIP85.fromBase58(rootKeyBase58);
  const index = parseInt(DOM.bip85Index.value);
  const length = parseInt(DOM.bip85MnemonicLength.value);
  const result = master.deriveBIP39(0, length, index).toMnemonic();
  DOM.bip39Phrase.value = result;
  toast('Loading Child Seed...');
  mnemonicToSeedPopulate();
};

// remove white space from ends and normalize per spec
const normalizeString = (str) => str.trim().normalize('NFKD');

// helper function to get the mnemonic
const getPhrase = () => normalizeString(DOM.bip39Phrase.value);

// helper function to get the passphrase
const getPassphrase = () => normalizeString(DOM.bip39Passphrase.value);

// helper function to get the user input entropy
const getEntropy = () => normalizeString(DOM.entropyInput.value);

/**
 * Helper function to try to find the nearest word to one given
 * @param {string} word word from wordList - may be misspelt
 * @returns {string} nearest word it could find in the wordList
 */
const findNearestWord = (word) => {
  let minDistance = 99;
  let closestWord = wordList[0];
  for (let i = 0; i < wordList.length; i++) {
    const comparedTo = wordList[i];
    if (comparedTo.indexOf(word) === 0) {
      return comparedTo;
    }
    const distance = new window.Levenshtein(word, comparedTo).distance;
    if (distance < minDistance) {
      closestWord = comparedTo;
      minDistance = distance;
    }
  }
  return closestWord;
};

/**
 * Test mnemonic phrase for errors
 * @param {string} phraseArg The mnemonic phrase
 * @returns {string} Any errors with the phrase
 */
const findPhraseErrors = (phraseArg) => {
  const phrase = normalizeString(phraseArg);
  const words = phraseToWordArray(phrase);
  // Detect blank phrase
  if (words.length == 0) {
    return 'Blank mnemonic';
  }
  // Check each word
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!wordList.includes(word)) {
      const nearestWord = findNearestWord(word);
      return `"${word}" was not found in the list, did you mean "${nearestWord}"`;
    }
  }
  // Check the words are valid
  const properPhrase = wordArrayToPhrase(words);
  const isValid = window.bip39.validateMnemonic(properPhrase);
  if (!isValid) {
    return 'Invalid mnemonic';
  }
  return '';
};

/**
 * Display a warning with mnemonic phrase errors
 * @param {string} errorText Text describing the error
 */
const showValidationError = (errorText) => {
  if (errorText) {
    DOM.bip39InvalidMessage.innerText = errorText + '. ';
    DOM.bip39Invalid.classList.remove('hidden');
  } else {
    DOM.bip39InvalidMessage.innerText = '';
    DOM.bip39Invalid.classList.add('hidden');
  }
  adjustPanelHeight();
};

/**
 * Get a random word from the diceware list
 * @returns {string} a random word from the diceware list
 */
const getRandomDiceWord = () =>
  diceware[
    crypto
      .getRandomValues(new Uint8Array(5))
      .map((n) => (n % 6) + 1)
      .join('')
  ];

const addRandomDiceWordToPassphrase = () => {
  DOM.bip39Passphrase.value += ' ' + getRandomDiceWord();
  DOM.bip39Passphrase.value = DOM.bip39Passphrase.value.trim();
  mnemonicToSeedPopulate();
};

// Event handler on entropy input
const entropyChanged = async () => {
  DOM.generateRandomStrengthSelect.value =
    DOM.entropyMnemonicLengthSelect.value === 'raw'
      ? DOM.generateRandomStrengthSelect.value
      : DOM.entropyMnemonicLengthSelect.value;
  DOM.mnemonicLengthSelect.value = DOM.generateRandomStrengthSelect.value;
  mnemonicInputLengthAdjust();
  document
    .getElementById('rawEntropyExplain')
    .classList.toggle(
      'hidden',
      DOM.entropyMnemonicLengthSelect.value !== 'raw'
    );
  adjustPanelHeight();
  // debounce?
  if (getEntropy().length === 0) {
    resetEverything();
    return;
  }
  // Get the current phrase to detect changes
  const phrase = getPhrase();
  // Set the phrase from the entropy
  await setMnemonicFromEntropy();
  // Recalculate addresses if the phrase has changed
  const newPhrase = getPhrase();
  if (newPhrase != phrase) {
    if (newPhrase.length == 0) {
      resetEverything();
    } else {
      // in case of raw entropy
      if (DOM.entropyMnemonicLengthSelect.value === 'raw') {
        DOM.generateRandomStrengthSelect.value = newPhrase.split(' ').length;
      }
      mnemonicToSeedPopulate();
    }
  } else {
    // hidePending();
  }
  textareaResize();
};

// If user chooses own entropy type
const entropyTypeChanged = () => {
  entropyTypeAutoDetect = false;
  entropyChanged();
};

// Calculate and display entropy
const calculateEntropy = async () => {
  const input = getEntropy();
  let entropy = null;
  if (entropyTypeAutoDetect) {
    entropy = window.Entropy.fromString(input);
  } else {
    const base = DOM.entropyMethod.value;
    entropy = window.Entropy.fromString(input, base);
  }
  const eventCount = entropy.base.events.length;
  const numberOfBits = entropy.binaryStr.length;
  const wordCount = Math.floor(numberOfBits / 32) * 3;
  const bitsPerEvent = entropy.base.bitsPerEvent?.toFixed(2) || '';
  const biasedBits = Math.floor(bitsPerEvent * eventCount);
  const spacedBinaryStr = entropy.binaryStr
    ? addSpacesEveryElevenBits(entropy.binaryStr)
    : '';
  let timeToCrack = '';
  try {
    const z = window.zxcvbn(entropy.base.events.join(''));
    timeToCrack = z.crack_times_display.offline_fast_hashing_1e10_per_second;
    if (z.feedback.warning != '') {
      timeToCrack = timeToCrack + ' - ' + z.feedback.warning;
    }
  } catch (e) {
    console.error('Error detecting entropy strength with zxcvbn:');
    console.error(e);
  }
  const reqWords = !!parseInt(DOM.entropyMnemonicLengthSelect.value)
    ? parseInt(DOM.entropyMnemonicLengthSelect.value)
    : wordCount;
  //
  DOM.entropyTimeToCrack.innerText = timeToCrack;
  DOM.entropyEventCount.innerText = eventCount;
  DOM.entropyEntropyType.innerText = getEntropyTypeStr(entropy);
  DOM.entropyMethod.value = entropy.base.str;
  DOM.entropyBitsPerEvent.innerText = bitsPerEvent;
  DOM.entropyRawWords.innerText = wordCount + '/' + reqWords;
  DOM.entropyTotalBits.innerText = `${numberOfBits}/${
    (reqWords * 32) / 3
  } (${biasedBits} with bias)`;
  DOM.entropyFiltered.innerHTML = entropy.cleanHtml;
  DOM.entropyRawBinary.innerText = spacedBinaryStr;
  const rawNoSpaces = DOM.entropyInput.value.replace(/\s/g, '');
  const cleanNoSpaces = entropy.cleanStr.replace(/\s/g, '');
  const isFiltered = rawNoSpaces.length !== cleanNoSpaces.length;
  if (isFiltered) {
    DOM.entropyFilterWarning.classList.remove('hidden');
  } else {
    DOM.entropyFilterWarning.classList.add('hidden');
  }
  await writeSplitPhrase();
  showWordIndexes();
  showChecksum();
};

/**
 * Asynchronous helper to hash a string
 * @param {string} text string to hash
 * @param {string=} algo which hashing algorithm to use
 * @returns {Promise} hexadecimal string of hash
 */
const hash = async (text, algo = 'SHA-256') => {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest(algo, msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex;
};

// Calculate and populate fields from user entropy
const setMnemonicFromEntropy = async () => {
  clearEntropyFeedback();
  // Get entropy value
  const entropyStr = getEntropy();
  // Work out minimum base for entropy
  let entropy = null;
  if (entropyTypeAutoDetect) {
    entropy = window.Entropy.fromString(entropyStr);
  } else {
    const base = DOM.entropyMethod.value;
    entropy = window.Entropy.fromString(entropyStr, base);
  }
  // No entropy, no seed
  if (entropy.binaryStr.length == 0) {
    return;
  }
  // Show entropy details
  await calculateEntropy(entropy);
  // Use biased bits to allow 99 dice roll
  const bits = Math.ceil(
    entropy.base.bitsPerEvent * entropy.base.events.length
  );
  // check for raw entropy
  if (DOM.entropyMnemonicLengthSelect.value === 'raw') {
    setMnemonicFromRawEntropy(entropy);
    return;
  }
  const mnemonicLength = parseInt(DOM.entropyMnemonicLengthSelect.value);
  // Refuse to make a seed with insufficient entropy
  if ((mnemonicLength / 3) * 32 > bits) {
    DOM.entropyWeakEntropyOverrideWarning.classList.remove('hidden');
    return;
  } else {
    DOM.entropyWeakEntropyOverrideWarning.classList.add('hidden');
  }
  // Warn if user is relying on biased bits
  if ((mnemonicLength / 3) * 32 > entropy.binaryStr.length) {
    DOM.entropyWeakEntropyWarning.classList.remove('hidden');
  } else {
    DOM.entropyWeakEntropyWarning.classList.add('hidden');
  }
  // Get bits by hashing entropy with SHA256
  let hex = await hash(entropy.cleanStr);
  // make sure the hash is at least 64 chars long
  // It should be but just in case
  while (hex.length % 64 !== 0) {
    hex = `0${hex}`;
  }
  const end = (mnemonicLength * 8) / 3;
  const hexedBin = hex.slice(0, end);
  // Convert entropy array to mnemonic
  const phrase = window.bip39.entropyToMnemonic(hexedBin);
  // Set the mnemonic in the UI
  DOM.bip39Phrase.value = phrase;
  makeCompactSeedQR();
  await writeSplitPhrase();
  // Show the word indexes
  showWordIndexes();
  // Show the checksum
  showChecksum();
  // Calculate addresses
  calculateAddresses();
  fillBip32Keys();
  calcBip85();
  calcBip47();
};

const setMnemonicFromRawEntropy = async (entropy) => {
  DOM.entropyWeakEntropyOverrideWarning.classList.add('hidden');
  DOM.entropyWeakEntropyWarning.classList.add('hidden');
  let bits = entropy.binaryStr.slice(0, 256);
  if (bits.length < 128) return; // min bits
  // user may still be typing
  if (bits.length % 32 !== 0) return;
  // convert from bin to hex
  const phrase = window.bip39.entropyToMnemonic(
    BigInt('0b' + bits).toString(16)
  );
  // Set the mnemonic in the UI
  DOM.bip39Phrase.value = phrase;
  makeCompactSeedQR();
  await writeSplitPhrase();
  // Show the word indexes
  showWordIndexes();
  // Show the checksum
  showChecksum();
  // Calculate addresses
  calculateAddresses();
  fillBip32Keys();
  calcBip85();
  calcBip47();
};

// get a string of what kind of entropy is detected for displaying
const getEntropyTypeStr = (entropy) => {
  let typeStr = entropy.base.str || 'Unknown';
  // Add some detail if these are cards
  if (entropy.base.asInt == 52 && entropy.binaryStr) {
    const cardDetail = []; // array of message strings
    // Detect duplicates
    const dupes = [];
    const dupeTracker = {};
    entropy.base.events.forEach((card) => {
      const cardUpper = card.toUpperCase();
      if (cardUpper in dupeTracker) {
        dupes.push(card);
      }
      dupeTracker[cardUpper] = true;
    });
    if (dupes.length > 0) {
      const dupeWord = dupes.length === 1 ? 'duplicate' : 'duplicates';
      let msg = `${dupes.length} ${dupeWord}: ${dupes.slice(0, 3).join(' ')}`;
      if (dupes.length > 3) {
        msg += '...';
      }
      cardDetail.push(msg);
    }
    // Detect full deck
    const uniqueCards = [];
    for (const uniqueCard in dupeTracker) {
      uniqueCards.push(uniqueCard);
    }
    if (uniqueCards.length == 52) {
      cardDetail.unshift('full deck');
    }
    // Detect missing cards
    /* cSpell:disable */
    const values = [
      'A',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'T',
      'J',
      'Q',
      'K',
    ];
    const suits = ['C', 'D', 'H', 'S'];
    /* cSpell:ensable */
    const missingCards = [];
    suits.forEach((suit) => {
      values.forEach((value) => {
        const card = value + suit;
        if (!(card in dupeTracker)) {
          missingCards.push(card);
        }
      });
    });
    // Display missing cards if six or less, ie clearly going for full deck
    if (missingCards.length > 0 && missingCards.length <= 6) {
      let msg = `${missingCards.length} missing: ${missingCards
        .slice(0, 3)
        .join(' ')}`;
      if (missingCards.length > 3) {
        msg += '...';
      }
      cardDetail.push(msg);
    }
    // Add card details to typeStr
    if (cardDetail.length > 0) {
      typeStr += ` (${cardDetail.join(', ')})`;
    }
  }
  return typeStr;
};
/**
 * Adds a space every eleven bits
 * @param {string} binaryStr - Binary string
 * @returns {string}
 */
const addSpacesEveryElevenBits = (binaryStr) =>
  binaryStr.match(/.{1,11}/g).join(' ');

const phraseToWordArray = (phrase = getPhrase()) => {
  const words = phrase.split(/\s/g);
  const noBlanks = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word.length > 0) {
      noBlanks.push(word);
    }
  }
  return noBlanks;
};

/**
 * Convert Array of seed words to the seed phrase string
 * @param {String[]} words Array of seed words
 * @returns {String} Joins the array into a string separated by spaces
 */
const wordArrayToPhrase = (words) => {
  const phrase = words.join(' ');
  // const language = getLanguageFromPhrase(phrase);
  // if (language == 'japanese') {
  //   phrase = words.join('\u3000');
  // }
  return phrase;
};

// Get an array of indexes from and array of words
const getWordIndexes = (words) => {
  const wordIndexes = [];
  words.forEach((word) => {
    wordIndexes.push(wordList.indexOf(word));
  });
  return wordIndexes;
};

// Display the indexes of the mnemonic phrase
const showWordIndexes = () => {
  const words = phraseToWordArray();
  const wordIndexesStr = getWordIndexes(words).join(', ');
  DOM.entropyWordIndexes.innerText = wordIndexesStr;
};

// display the checksum of the used entropy
const showChecksum = () => {
  const words = phraseToWordArray();
  const checksumBitlength = words.length / 3;
  let checksum = '';
  let binaryStr = '';
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    const wordIndex = wordList.indexOf(word);
    let wordBinary = wordIndex.toString(2);
    while (wordBinary.length < 11) {
      wordBinary = '0' + wordBinary;
    }
    binaryStr = wordBinary + binaryStr;
    if (binaryStr.length >= checksumBitlength) {
      const start = binaryStr.length - checksumBitlength;
      const end = binaryStr.length;
      checksum = binaryStr.substring(start, end);
      // add spaces so the last group is 11 bits, not the first
      checksum = checksum.split('').reverse().join('');
      checksum = addSpacesEveryElevenBits(checksum);
      checksum = checksum.split('').reverse().join('');
      break;
    }
  }
  DOM.entropyBinaryChecksum.innerText = checksum;
};

// Get Mnemonic sentence
const createMnemonic = () => {
  const numWords = parseInt(DOM.generateRandomStrengthSelect.value);
  const strength = (numWords / 3) * 32;
  const mnemonic = bip39.generateMnemonic(strength);
  return mnemonic;
};

// Generate a random mnemonic when button is clicked
const generateNewMnemonic = () => {
  toast('Calculating...');
  DOM.bip39Phrase.value = createMnemonic();
  // DOM.knownInputTextarea.value = mnemonic;
  mnemonicToSeedPopulate();
};

// Split the mnemonic phrase over 3 cards
const writeSplitPhrase = async () => {
  const phrase = getPhrase();
  const wordCount = phrase.split(/\s/g).length;
  const msgUint8 = new TextEncoder().encode(phrase);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const left = [];
  for (let i = 0; i < wordCount; i++) {
    left.push(i);
  }
  const group = [[], [], []];
  let groupI = -1;
  let seedNum = Math.abs(hashArray[0]) % 2147483647;
  while (left.length > 0) {
    groupI = (groupI + 1) % 3;
    seedNum = (seedNum * 16807) % 2147483647;
    const selected = Math.floor((left.length * (seedNum - 1)) / 2147483646);
    group[groupI].push(left[selected]);
    left.splice(selected, 1);
  }
  const cards = [phrase.split(/\s/g), phrase.split(/\s/g), phrase.split(/\s/g)];
  for (let i = 0; i < 3; i++) {
    for (let ii = 0; ii < wordCount / 3; ii++) cards[i][group[i][ii]] = 'XXXX';
    cards[i] = 'Card ' + (i + 1) + ': ' + wordArrayToPhrase(cards[i]);
  }
  DOM.bip39PhraseSplit.value = cards.join('\r\n');
  const triesPerSecond = 10000000000;
  let hackTime = Math.pow(2, (wordCount * 10) / 3) / triesPerSecond;
  let displayRedText = false;
  if (hackTime < 1) {
    hackTime = '<1 second';
    displayRedText = true;
  } else if (hackTime < 86400) {
    hackTime = Math.floor(hackTime).toLocaleString() + ' seconds';
    displayRedText = true;
  } else if (hackTime < 31557600) {
    hackTime = Math.floor(hackTime / 86400) + ' days';
    displayRedText = true;
  } else {
    hackTime = Math.floor(hackTime / 31557600).toLocaleString() + ' years';
  }
  DOM.bip39PhraseSplitWarn.innerHTML =
    'Time to hack with only one card: ' + hackTime;
  if (displayRedText) {
    DOM.bip39PhraseSplitWarn.classList.add('warning');
  } else {
    DOM.bip39PhraseSplitWarn.classList.remove('warning');
  }
};

// Get the word associated with the dice the user rolled
// 5 rolls gets one word
const diceToPassphrase = () => {
  const input = normalizeString(DOM.bip39PassGenInput.value);
  const data = input.split('').filter((char) => !!char.match(/[1-6]/));
  if (data.length < 5) return;
  const words = [];
  while (data.length > 4) {
    words.push(diceware[data.slice(0, 5).join('')]);
    data.splice(0, 5);
  }
  if (!words.length) return;
  DOM.bip39Passphrase.value = words.join(' ');
  mnemonicToSeedPopulate();
};
/**
 * Called when mnemonic is updated
 */
const mnemonicToSeedPopulate = debounce(async () => {
  const mnemonic = getPhrase();
  const passphrase = getPassphrase();
  if (!passphrase) {
    DOM.bip39PassphraseCrackTime.innerText = 'No passphrase entered!';
  } else {
    const crackTime = zxcvbn(passphrase);
    const crackText =
      crackTime?.crack_times_display?.offline_fast_hashing_1e10_per_second;
    if (crackText) {
      DOM.bip39PassphraseCrackTime.innerText = 'Time to crack: ' + crackText;
      if (crackText !== 'centuries') {
        DOM.bip39PassphraseCrackTime.parentElement.classList.add('warning');
      } else {
        DOM.bip39PassphraseCrackTime.parentElement.classList.remove('warning');
      }
    }
  }
  let seedHex = '';
  resetEverything();
  seed = null;
  // Test if valid
  const errorText = findPhraseErrors(mnemonic);
  showValidationError(errorText);
  if (!errorText) {
    seed = bip39.mnemonicToSeedSync(mnemonic, passphrase);
    seedHex = seed.toString('hex');
  } else {
    return;
  }
  DOM.mnemonicLengthSelect.value = mnemonic.split(' ').length;
  DOM.entropyMnemonicLengthSelect.value = DOM.mnemonicLengthSelect.value;
  DOM.generateRandomStrengthSelect.value = DOM.mnemonicLengthSelect.value;
  mnemonicInputLengthAdjust();
  DOM.bip39Seed.value = seedHex;
  if (!DOM.bip39Phrase.readOnly) {
    DOM.entropyInput.value = seedHex;
  }
  await calculateEntropy();
  if (seed) {
    const node = bip32.fromSeed(seed);
    bip32RootKey = node;
  } else {
    bip32RootKey = null;
  }
  DOM.bip32RootKey.value = bip32RootKey ? bip32RootKey.toBase58() : 'unknown';
  DOM.bip32RootFingerprint.value = bip32RootKey
    ? bip32RootKey.fingerprint.toString('hex')
    : 'unknown';
  if (bip32RootKey) {
    DOM.bip32RootWif.value = bip32RootKey.toWIF();
    calculateAddresses();
    fillBip32Keys();
    calcBip85();
    calcBip47();
  }
  fillRandomXorSeeds();
  calculateXor();
  await generateOneTimePad();
  makeCompactSeedQR();
  adjustPanelHeight();
}, 1000);

// Empty all fields
const resetEverything = () => {
  seed = null;
  bip32RootKey = null;
  myPayCode = null;
  bobPayCode = null;
  DOM.bip32RootKey.value = '';
  DOM.bip32RootFingerprint.value = '';
  DOM.bip32RootWif.value = '';
  if (!DOM.bip39Phrase.readOnly) {
    DOM.entropyInput.value = '';
  }
  clearEntropyFeedback();
  clearCompactSeedQR();
  DOM.bip39PhraseSplit.value = '';
  DOM.bip39Seed.value = '';
  DOM.pathAccountXprv.value = '';
  DOM.pathAccountXpub.value = '';
  DOM.bip85Application.value = 'bip39';
  DOM.bip85MnemonicLength.value = '24';
  DOM.bip85Bytes.value = '64';
  DOM.bip85Index.value = '0';
  DOM.bip85ChildKey0.value = '';
  DOM.bip85ChildKey1.value = '';
  DOM.bip85ChildKey2.value = '';
  DOM.bip85ChildKey3.value = '';
  DOM.bip85ChildKey4.value = '';
  DOM.bip47MyPaymentCode.value = '';
  DOM.bip47MyNotificationAddress.value = '';
  DOM.bip47MyNotificationPrvKey.value = '';
  DOM.bip47MyNotificationPubKey.value = '';
  DOM.bip47CPPaymentCode.value = '';
  DOM.bip47CPNotificationAddress.value = '';
  DOM.bip47CPNotificationPubKey.value = '';
  document.getElementById('otpDecrypted').value = '';
  document.getElementById('otpMatched').innerHTML = '';
  document.getElementById('otpKey').value = '';
  document.getElementById('otpCipherText').value = '';
};

// Empty entropy fields
const clearEntropyFeedback = () => {
  DOM.entropyTimeToCrack.innerText = '';
  DOM.entropyEventCount.innerText = '';
  DOM.entropyEntropyType.innerText = '';
  DOM.entropyBitsPerEvent.innerText = '';
  DOM.entropyRawWords.innerText = '';
  DOM.entropyTotalBits.innerText = '';
  DOM.entropyFiltered.innerText = '';
  DOM.entropyRawBinary.innerText = '';
  DOM.entropyBinaryChecksum.innerText = '';
  DOM.entropyWordIndexes.innerText = '';
};

/*
 * Seed One Time Pad
 * SuperPhatArrow
 *
 * Ported from the python cli tool
 * seed-otp (Unlicense)
 * https://github.com/brndnmtthws/seed-otp
 *
 * Useage:
 * await otp.generate(12)
 *  -> returns a key for a 12 word mnemonic
 * await otp.encrypt('AAwCnwGIAe0EWABWAI4AkAMjAFQBLgZjB1T1PJtz','abandon ability able about above absent absorb abstract absurd abuse access accident')
 *  -> returns a scrambled mnemonic
 * await otp.decrypt('AAwCnwGIAe0EWABWAI4AkAMjAFQBLgZjB1T1PJtz','fault couple digital merge area bar barrel grab argue cheap soap typical')
 *  -> returns original mnemonic
 *
 */

const otp = {
  /**
   * otp.generate
   * @param {number} numberOfWords Mnemonic length
   * @returns {string} One Time Pad Key
   */
  async generate(numberOfWords) {
    if (numberOfWords % 3 !== 0 || numberOfWords < 12 || numberOfWords > 24)
      throw new Error('Incorrect number of words');
    const keyList = new Uint16Array(numberOfWords);
    for (let i = 0; i < numberOfWords; i++) {
      let randomNumber = 2048;
      do {
        randomNumber = crypto.getRandomValues(new Uint16Array(1))[0];
      } while (randomNumber >= 2048);
      keyList[i] = randomNumber;
    }
    const keyList8 = new Uint8Array(keyList.buffer);
    if (!isBigEndian()) {
      endianness(keyList8, 2);
    }
    const keyArray = new Uint8Array([0, numberOfWords, ...keyList8]);
    const hash = await crypto.subtle.digest('SHA-256', keyArray);
    const checksum = new Uint8Array(hash.slice(0, 4));
    const full = new Uint8Array(keyArray.length + checksum.length);
    full.set(keyArray, 0);
    full.set(checksum, keyArray.length);
    const base64url = await new Promise((r) => {
      const reader = new FileReader();
      reader.onload = () => r(reader.result);
      reader.readAsDataURL(new Blob([full]));
    });
    return base64url.split(',', 2)[1].replaceAll('=', '');
  },
  /**
   * otp.encrypt
   * @param {string} key One Time Pad Key
   * @param {string} mnemonic The Mnemonic to encrypt
   * @returns {string} Encrypted Mnemonic
   */
  async encrypt(key, mnemonic) {
    const words = normalizeString(mnemonic).split(' ');
    while (key.length % 4 !== 0) {
      key += '=';
    }
    let keyArray = this._getKeyArrayFromBase64(key);
    if (keyArray[1] !== words.length) {
      throw new Error('Mnemonic length does not match key');
    }
    const checksumOk = await this._testChecksum(keyArray);
    if (!checksumOk) return;
    const keyPayload = new Uint8Array(keyArray.slice(0, keyArray.length - 4));
    const dataView = this._getUint16(keyPayload);
    const encrypted = words.map((word, i) => {
      const wordIndex = wordList.findIndex((w) => w === word);
      const encWord = wordList[(wordIndex + dataView[i]) % 2048];
      return encWord;
    });
    return encrypted.join(' ');
  },
  /**
   * otp.decrypt
   * @param {string} key One Time Pad Key
   * @param {string} cipherMnemonic Encripted Mnemonic
   * @returns {string} Decrypted Mnemonic
   */
  async decrypt(key, cipherMnemonic) {
    const words = normalizeString(cipherMnemonic).split(' ');
    while (key.length % 4 !== 0) {
      key += '=';
    }
    let keyArray = this._getKeyArrayFromBase64(key);
    if (keyArray[1] !== words.length) {
      throw new Error('Mnemonic length does not match key');
    }
    const checksumOk = await this._testChecksum(keyArray);
    if (!checksumOk) return;
    const keyPayload = new Uint8Array(keyArray.slice(0, keyArray.length - 4));
    const dataView = this._getUint16(keyPayload);
    const decrypted = [];
    for (let i = 0; i < words.length; i++) {
      const cipherWord = words[i];
      const cipherIndex = wordList.findIndex((w) => w === cipherWord);
      const index = (cipherIndex - dataView[i] + 2048) % 2048;
      const word = wordList[index];
      decrypted.push(word);
    }
    return decrypted.join(' ');
  },
  async validateKey(key, numberOfWords) {
    let keyArray = this._getKeyArrayFromBase64(key);
    if (keyArray[1] !== numberOfWords) return false;
    const checksumOk = await this._testChecksum(keyArray);
    if (!checksumOk) return false;
    const keyPayload = new Uint8Array(keyArray.slice(0, keyArray.length - 4));
    const dataView = this._getUint16(keyPayload);
    if (dataView.length !== numberOfWords) return false;
    return true;
  },
  async _testChecksum(keyArray) {
    const divider = keyArray.length - 4;
    const keyChecksum = keyArray.slice(divider);
    const keyPayload = new Uint8Array(keyArray.slice(0, divider));
    const hash = await crypto.subtle.digest('SHA-256', keyPayload);
    const checksum = new Uint8Array(hash.slice(0, 4));
    if (keyChecksum.toString() !== checksum.toString()) {
      console.error('Checksum does not match');
      return false;
    }
    return true;
  },
  _getKeyArrayFromBase64(keyBase64) {
    return window
      .atob(keyBase64)
      .split('')
      .map((c) => c.charCodeAt(0));
  },
  _getUint16(keyPayload) {
    const buffer = new ArrayBuffer(keyPayload.length - 2);
    const dataView = new Uint16Array(buffer);
    if (!isBigEndian()) {
      let count = 2;
      for (let i = 0; i < dataView.length; i++) {
        dataView[i] = (keyPayload[count++] << 8) + keyPayload[count++];
      }
    }
    return dataView;
  },
};

const isBigEndian = () => {
  const uInt32 = new Uint32Array([0x11223344]);
  const uInt8 = new Uint8Array(uInt32.buffer);
  return uInt8[0] === 0x11;
};

/*
 * Endianness
 * Copyright (c) 2017-2018 Rafael da Silva Rocha.
 *
 * MIT License
 *
 */

/**
 * @see https://github.com/rochars/endianness
 */

/**
 * Swap the byte ordering in a buffer. The buffer is modified in place.
 * @param {!Array|!Uint8Array} bytes The bytes.
 * @param {number} offset The byte offset.
 * @param {number=} start The start index. Assumes 0.
 * @param {number=} end The end index. Assumes the buffer length.
 * @throws {Error} If the buffer length is not valid.
 */
function endianness(bytes, offset, start = 0, end = bytes.length) {
  if (end % offset) {
    throw new Error('Bad buffer length.');
  }
  for (let index = start; index < end; index += offset) {
    swap(bytes, offset, index);
  }
}

/**
 * Swap the byte order of a value in a buffer. The buffer is modified in place.
 * @param {!Array|!Uint8Array} bytes The bytes.
 * @param {number} offset The byte offset.
 * @param {number} index The start index.
 * @private
 */
function swap(bytes, offset, index) {
  offset--;
  for (let x = 0; x < offset; x++) {
    /** @type {*} */
    let theByte = bytes[index + x];
    bytes[index + x] = bytes[index + offset];
    bytes[index + offset] = theByte;
    offset--;
  }
}
