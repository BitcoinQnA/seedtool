/**
______ _ _            _       _____        ___  
| ___ (_) |          (_)     |  _  |      / _ \ 
| |_/ /_| |_ ___ ___  _ _ __ | | | |_ __ / /_\ \
| ___ \ | __/ __/ _ \| | '_ \| | | | '_ \|  _  |
| |_/ / | || (_| (_) | | | | \ \/' / | | | | | |
\____/|_|\__\___\___/|_|_| |_|\_/\_\_| |_\_| |_/
                                                
                                                
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
let currentBip = 'bip84';
let network;
let isTestnet = false;
let wordList = [];
let myPayCode = null;
let bobPayCode = null;
let entropyTypeAutoDetect = true;
let lastInnerWidth = parseInt(window.innerWidth);
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
const DOM = {};
const setupDom = () => {
  DOM.accordionButtons = document.querySelectorAll('.accordion');
  DOM.accordionPanels = document.querySelectorAll('.panel');
  DOM.aboutPanel = document.getElementById('aboutPanel');
  DOM.allTabContents = document.querySelectorAll('.tabContent');
  DOM.allTabLinks = document.querySelectorAll('.tabLinks');
  DOM.allBipsContents = document.querySelectorAll('.bipsContent');
  DOM.generateRandomStrengthSelect = document.getElementById(
    'generateRandomStrength'
  );
  DOM.copyWrapper = document.querySelectorAll('.copy-wrapper');
  DOM.generateButton = document.querySelector('.btn.generate');
  DOM.bip32RootKey = document.getElementById('bip32RootKey');
  // DOM.knownInputTextarea = document.getElementById('knownInputTextarea');
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
  DOM.bip39ShowSplitMnemonic = document.getElementById(
    'bip39ShowSplitMnemonic'
  );
  DOM.bip39SplitMnemonicSection = document.getElementById('splitMnemonic');
  DOM.bip39Passphrase = document.getElementById('bip39Passphrase');
  DOM.bip39PassphraseCrackTime = document.getElementById(
    'bip39PassphraseCrackTime'
  );
  DOM.hidePassphraseGeneration = document.getElementById(
    'hidePassphraseGeneration'
  );
  DOM.bip39PassGenSection = document.getElementById('bip39PassGenSection');
  DOM.bip39PassGenInput = document.getElementById('bip39PassGenInput');
  DOM.bip39Seed = document.getElementById('bip39Seed');
  DOM.bip39Invalid = document.querySelector('.bip39-invalid-phrase');
  DOM.bip39InvalidMessage = document.getElementById('bip39ValidationError');
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
  DOM.bip85ChildKey = document.getElementById('bip85ChildKey');
  DOM.bip85LoadParent = document.getElementById('bip85LoadParent');
  DOM.bip85LoadChild = document.getElementById('bip85LoadChild');
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
  DOM.hidePrivateData = document.getElementById('hidePrivateData');
  DOM.onlineIcon = document.getElementById('networkIndicator');

  network = bitcoin.networks.bitcoin;
  // Show / hide split mnemonic cards
  DOM.bip39ShowSplitMnemonic.addEventListener('click', () => {
    if (DOM.bip39ShowSplitMnemonic.checked) {
      DOM.bip39SplitMnemonicSection.classList.remove('hidden');
    } else {
      DOM.bip39SplitMnemonicSection.classList.add('hidden');
    }
    adjustPanelHeight();
  });
  // hidePassphraseGeneration
  // Show / hide split mnemonic cards
  DOM.hidePassphraseGeneration.addEventListener('click', () => {
    if (DOM.hidePassphraseGeneration.checked) {
      DOM.bip39PassGenSection.classList.remove('hidden');
    } else {
      DOM.bip39PassGenSection.classList.add('hidden');
    }
    adjustPanelHeight();
  });
  // listen for if entropy method changes
  DOM.entropyMethod.oninput = entropyTypeChanged;

  // listen for address generate button clicks
  DOM.addressGenerateButton.onclick = generateAddresses;
  DOM.path.oninput = generateAddresses;

  // listen for change in derivedPathSelect
  DOM.derivedPathSelect.oninput = derivedPathSelectChanged;
  derivedPathSelectChanged();
  // listen for bip47 changes
  DOM.bip47UsePaynym.oninput = togglePaynym;
  DOM.bip47CPPaymentCode.oninput = calcBip47CounterParty;
  DOM.bip47AddressType.oninput = calculateBip47Addresses;
  DOM.bip47SendReceive.oninput = calculateBip47Addresses;
  DOM.bip47StartIndex.oninput = calculateBip47Addresses;
  DOM.bip47NoOfAddresses.oninput = calculateBip47Addresses;
  // listen for bip85 changes
  DOM.bip85Application.oninput = calcBip85;
  DOM.bip85MnemonicLength.oninput = calcBip85;
  DOM.bip85Bytes.oninput = calcBip85;
  DOM.bip85Index.oninput = calcBip85;
  DOM.bip85LoadParent.addEventListener('click', bip85LoadParent);
  DOM.bip85LoadChild.addEventListener('click', bip85LoadChild);
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
  // hide private data
  DOM.hidePrivateData.oninput = hideAllPrivateData;
  // Copy button
  DOM.copyWrapper.forEach(setupCopyButton);
  // FOOTER: calculate copyright year
  document.querySelectorAll('.cYear').forEach((yearSpan) => {
    let output = '';
    const currentYear = new Date().getFullYear();
    const originYear = parseInt(yearSpan.innerHTML);
    if (currentYear - originYear > 10) {
      output = '&nbsp;-&nbsp;' + originYear + 10;
    } else if (currentYear !== originYear) {
      output = '&nbsp;-&nbsp;' + currentYear;
    }
    yearSpan.innerHTML += output;
  });
  // Make sure that the generate seed tab is open
  document.getElementById('defaultOpenTab').click();
  // Setup one click copy
  document.querySelectorAll('.one-click-copy').forEach((textElement) => {
    textElement.addEventListener('click', copyEventHandler);
  });
  // add listener for bip44 path inputs
  DOM.pathCoin.oninput = changePath;
  DOM.pathAccount.oninput = changePath;
  DOM.pathChange.oninput = changePath;
  // Add event listener for displaying/hiding entropy details
  // DOM.entropyDisplay.addEventListener('click', () => {
  //   displayEntropy(DOM.entropyDisplay.checked);
  // });
  // add event listener for entropy
  DOM.entropyInput.oninput = entropyChanged;
  DOM.entropyMnemonicLengthSelect.oninput = entropyChanged;
  // add event listener for new mnemonic / passphrase
  DOM.bip39Passphrase.oninput = mnemonicToSeedPopulate;
  DOM.bip39Phrase.oninput = mnemonicToSeedPopulate;
  DOM.bip39PassGenInput.oninput = diceToPassphrase;
  // Add event listener to generate new mnemonic
  DOM.generateButton.addEventListener('click', generateNewMnemonic);
  // update pointer to word list
  wordList = bip39.wordlists[Object.keys(bip39.wordlists)[0]];
  // open the about panel on load
  DOM.aboutPanel.click();
  // show user when connected to a network for security
  window.addEventListener('offline', (event) => {
    DOM.onlineIcon.classList.add('hidden');
  });
  window.addEventListener('online', (event) => {
    DOM.onlineIcon.classList.remove('hidden');
  });
  // set it now
  if (window.navigator.onLine) {
    DOM.onlineIcon.classList.remove('hidden');
  }
  resizeObserver.observe(document.querySelector('body'));
  document.getElementById('loadingPage').style.display = 'none';
};

// Run setupDom function when the page has loaded
window.addEventListener('DOMContentLoaded', setupDom);

// Hide all private data
const hideAllPrivateData = () => {
  if (DOM.hidePrivateData.checked) {
    document.querySelectorAll('.private-data').forEach((el) => {
      el.classList.add('private-data--hidden');
    });
  } else {
    document.querySelectorAll('.private-data').forEach((el) => {
      el.classList.remove('private-data--hidden');
    });
  }
  adjustPanelHeight();
};

// adjust textarea rows/height
function textareaResize() {
  document.querySelectorAll('textarea').forEach((textareaElement) => {
    // set textarea width to 100%
    textareaElement.style.width = '100%';
    // measure the max width we can have
    const maxWidth = textareaElement.clientWidth;
    // Remove width style
    textareaElement.style.width = '';
    // set cols low
    textareaElement.cols = 5;
    while (textareaElement.clientWidth < maxWidth) {
      // keep adding columns until we go over max width
      textareaElement.cols++;
    }
    // one column less to stay under 100%
    textareaElement.cols--;
    // Now adjust the rows based on the number of characters in the textarea
    const maxRows = 10;
    const txt = textareaElement.value;
    const cols = textareaElement.cols;
    const arrayText = txt.split('\n');
    let rows = arrayText.length;
    for (i = 0; i < arrayText.length; i++)
      rows += parseInt(arrayText[i].length / cols);
    if (rows > maxRows) textareaElement.rows = maxRows;
    else textareaElement.rows = rows;
  });
}

const resizeObserver = new ResizeObserver((entries) => {
  if (lastInnerWidth === innerWidth) return;
  adjustPanelHeight();
});

// Add Copy Buttons
const setupCopyButton = (element) => {
  if (!('content' in document.createElement('template'))) return;
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

//
const copyEventHandler = (event) => {
  event.preventDefault();
  const textElement = event.currentTarget;
  const text = textElement.innerText || textElement.value;
  copyTextToClipboard(text);
};

// BIP47 functions

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
        // dont add an image without a payCode
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
    console.error(error); // TODO remove this for prod
  }
  adjustPanelHeight();
};

const calcBip47 = () => {
  if (!getPhrase()) return;
  const mySeed = bip39.mnemonicToSeedSync(getPhrase(), getPassphrase());
  myPayCode = bip47.fromWalletSeed(mySeed, 0, network);
  const myNotify = myPayCode.derive(0);
  const myPrvKey = myNotify.privateKey;
  const myPubKey = myNotify.publicKey;
  const myNotificationAddress = myPayCode.getNotificationAddress();
  DOM.bip47MyPaymentCode.value = myPayCode.toBase58();
  DOM.bip47MyNotificationAddress.value = myNotificationAddress;
  DOM.bip47MyNotificationPrvKey.value =
    bitcoin.ECPair.fromPrivateKey(myPrvKey).toWIF();
  DOM.bip47MyNotificationPubKey.value = myPubKey.toString('hex');
  fetchRobotImages();
};
const isValidPaymentCode = (paymentCode) => {
  try {
    bip47.fromBase58(paymentCode, network);
    return true;
  } catch (_error) {
    return false;
  }
};
const calcBip47CounterParty = () => {
  const bobPcBase58 = normalizeString(DOM.bip47CPPaymentCode.value);
  if (!isValidPaymentCode(bobPcBase58)) {
    DOM.bip47CPGenSection.classList.add('hidden');
    adjustPanelHeight();
    return;
  }
  DOM.bip47CPGenSection.classList.remove('hidden');
  bobPayCode = bip47.fromBase58(bobPcBase58, network);
  const bobNotifyPubKey = bobPayCode.derive(0).publicKey;
  const bobNotifyAddress = bobPayCode.getNotificationAddress();
  DOM.bip47CPNotificationAddress.value = bobNotifyAddress;
  DOM.bip47CPNotificationPubKey.value = bobNotifyPubKey.toString('hex');
  calculateBip47Addresses();
  adjustPanelHeight();
  fetchRobotImages();
};

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

/**
 * Injects address data into the assigned address list
 * @param {AddressData[]} addressDataArray - an array of AddressData objects.
 * @param {string} addressListName - a string saying which address list to populate. e.g. 'bip32'
 */
const injectBip47Addresses = (addressDataArray) => {
  // Init the csv string with the headers
  let csv = `path,address,public key,private key
`;
  // declare DOM elements
  DOM.bip47CsvDownloadLink.classList.remove('hidden');
  const template = document.querySelector('#addressTemplate');
  // Ensure not internet explorer!
  if (!('content' in document.createElement('template'))) {
    throw new Error(
      'Browser Outdated! Unable to populate list and generate csv.'
    );
  }
  addressDataArray.forEach((addressData) => {
    // Append this address to csv
    csv += `${addressData.path},${addressData.address},${addressData.pubKey},${
      addressData.prvKey || 'N/A'
    },
`;
    // clone the address list template HTML
    const clone = template.content.firstElementChild.cloneNode(true);
    // Insert the path, address, public key & private key into the clone
    for (const data in addressData) {
      if (Object.hasOwnProperty.call(addressData, data)) {
        clone.querySelector(`.address-details--${data}`).innerText =
          addressData[data];
      }
    }
    // Add the clone to the DOM
    DOM.bip47AddressListContainer.appendChild(clone);
  });
  hideAllPrivateData();
  DOM.bip47CsvDownloadLink.href = `data:text/csv;charset=utf-8,${encodeURI(
    csv
  )}`;
};

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
      switch (addressType) {
        case 'P2PKH':
          address = bitcoin.payments.p2pkh({
            pubkey: payPubKey,
            network: network,
          }).address;
          break;
        case 'P2WPKH':
          address = bitcoin.payments.p2wpkh({
            pubkey: payPubKey,
            network: network,
          }).address;
          break;
        case 'P2WPKH/P2SH':
          address = bitcoin.payments.p2sh({
            redeem: bitcoin.payments.p2wpkh({
              pubkey: payPubKey,
              network: network,
            }),
            network: network,
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
    injectBip47Addresses(addressDataArray);
  } catch (error) {
    console.error(error?.message || error);
    console.error(error);
  }
};

const getAddress = (node) => {
  if (currentBip === 'bip49') {
    return bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({
        pubkey: node.publicKey,
        network,
      }),
      network,
    }).address;
  }
  if (currentBip === 'bip84') {
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
// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
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
const derivedPathSelectChanged = () => {
  const bip = DOM.derivedPathSelect.value;
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
  } else if (bip === 'bip141') {
    DOM.bip141ScriptSelectDiv.classList.remove('hidden');
    DOM.pathInputSection.classList.add('hidden');
    DOM.path.readOnly = false;
  } else {
    DOM.pathPurpose.value = bip.slice(3);
    document.getElementById('pathBipText').innerText = bip.toUpperCase();
    changePath();
  }
  DOM.addressGenerateButton.click();
  adjustPanelHeight();
};
/**
 * QnA Explains dialog / Modal
 */
DOM.infoModal = document.getElementById('infoModal');
DOM.infoModalText = document.getElementById('infoModalText');
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
  if (event.target == DOM.infoModal) {
    clearInfoModal();
  }
};
/**
 * If navigator.clipboard is not available, here is fallback
 * @param {string} text text to copy
 */
function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;

  // Avoid scrolling to bottom
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    let msg = successful ? 'successful' : 'unsuccessful';
    toast('Copied to clipboard');
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
    toast('ERROR: Unable to copy to clipboard');
  }

  document.body.removeChild(textArea);
}
/**
 * Copy text to clipboard
 * @param {string} text text to copy
 */
function copyTextToClipboard(text) {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text);
  } else {
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
/**
 * Display / Hide Entropy details
 * @param {boolean} checked Is the checkbox checked
 */
// function displayEntropy(checked) {
//   DOM.entropyDetailsContainer = document.getElementById(
//     'entropyDetailsContainer'
//   );
//   if (checked) {
//     // show details
//     DOM.entropyDetailsContainer.style.display = 'flex';
//   } else {
//     DOM.entropyDetailsContainer.style.display = 'none';
//   }
//   adjustPanelHeight();
// }
/**
 * Whenever some CSS changes in an accordion panel, call this to fix the panel
 */
function adjustPanelHeight() {
  textareaResize();
  DOM.accordionPanels.forEach((panel) => {
    const isActive = panel.classList.contains('accordion-panel--active');
    if (isActive) {
      panel.style.maxHeight = panel.scrollHeight + 'px';
    } else {
      panel.style.maxHeight = null;
    }
  });
}

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
   * @param {string} pubKey - The public key.
   * @param {string=} prvKey - The private key.
   */
  constructor(path, address, pubKey, prvKey) {
    this.path = path;
    this.address = address;
    this.pubKey = pubKey;
    this.prvKey = prvKey;
  }
}
/**
 * Injects address data into the assigned address list
 * @param {AddressData[]} addressDataArray - an array of AddressData objects.
 * @param {string} addressListName - a string saying which address list to populate. e.g. 'bip32'
 */
const injectAddresses = (addressDataArray) => {
  // Init the csv string with the headers
  let csv = `path,address,public key,private key
`;
  // declare DOM elements
  DOM.csvDownloadLink.classList.remove('hidden');
  const template = document.querySelector('#addressTemplate');
  // Ensure not internet explorer!
  if (!('content' in document.createElement('template'))) {
    throw new Error(
      'Browser Outdated! Unable to populate list and generate csv.'
    );
  }
  addressDataArray.forEach((addressData) => {
    // Append this address to csv
    csv += `${addressData.path},${addressData.address},${addressData.pubKey},${addressData.prvKey},
`;
    // clone the address list template HTML
    const clone = template.content.firstElementChild.cloneNode(true);
    // Insert the path, address, public key & private key into the clone
    for (const data in addressData) {
      if (Object.hasOwnProperty.call(addressData, data)) {
        clone.querySelector(`.address-details--${data}`).innerText =
          addressData[data];
      }
    }
    // Add the clone to the DOM
    DOM.addressListContainer.appendChild(clone);
  });
  hideAllPrivateData();
  DOM.csvDownloadLink.href = `data:text/csv;charset=utf-8,${encodeURI(csv)}`;
};

const calculateAddresses = (startIndex = 0, endIndex = 19) => {
  clearAddresses();
  if (!bip32RootKey) {
    return;
  }
  try {
    const node = bip32RootKey;
    const path = (i) => `${DOM.path.value}/${i}`;
    // if (!path()) {
    //   console.error('Unable to generate addresses without valid path');
    //   return;
    // }
    // const node = bip32.fromSeed(seed);
    const addressDataArray = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const addressPath = path(i);
      const addressNode = node.derivePath(addressPath);
      const address = getAddress(addressNode);
      const addressPubKey = addressNode.publicKey.toString('hex');
      const addressPrivKey = bitcoin.ECPair.fromPrivateKey(
        addressNode.privateKey
      ).toWIF();
      addressDataArray[i] = new AddressData(
        addressPath,
        address,
        addressPubKey,
        addressPrivKey
      );
    }
    injectAddresses(addressDataArray);
  } catch (error) {
    console.error(error?.message || error);
  }
};

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

const clearAddresses = () => {
  DOM.csvDownloadLink.classList.add('hidden');
  while (DOM.addressListContainer.firstChild) {
    DOM.addressListContainer.removeChild(DOM.addressListContainer.firstChild);
  }
  adjustPanelHeight();
};

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
  DOM.bip32AccountXpub.value = bip32ExtendedKey.neutered().toBase58();
  if (currentBip !== 'bip32') {
    displayAccountKeys();
  }
};

const displayAccountKeys = () => {
  const purpose = DOM.pathPurpose.value;
  const coin = DOM.pathCoin.value;
  const account = DOM.pathAccount.value;
  const accountPath = `m/${purpose}'/${coin}'/${account}'`;
  const accountExtendedKey = bip32RootKey.derivePath(accountPath);
  DOM.pathAccountXprv.value = accountExtendedKey.toBase58();
  DOM.pathAccountXpub.value = accountExtendedKey.neutered().toBase58();
};

const calcBip85 = () => {
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
    let result;
    const index = parseInt(DOM.bip85Index.value);
    if (app === 'bip39') {
      const length = parseInt(DOM.bip85MnemonicLength.value);
      result = master.deriveBIP39(0, length, index).toMnemonic();
    } else if (app === 'wif') {
      result = master.deriveWIF(index).toWIF();
    } else if (app === 'xprv') {
      result = master.deriveXPRV(index).toXPRV();
    } else if (app === 'hex') {
      const bytes = parseInt(DOM.bip85Bytes.value);

      result = master.deriveHex(bytes, index).toEntropy();
    }
    DOM.bip85ChildKey.value = result;
  } catch (e) {
    toast('BIP85: ' + e.message);
    DOM.bip85ChildKey.value = '';
  }
};

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

const normalizeString = (str) => str.trim().normalize('NFKD');

const getPhrase = () => normalizeString(DOM.bip39Phrase.value);

const getPassphrase = () => normalizeString(DOM.bip39Passphrase.value);

const getEntropy = () => normalizeString(DOM.entropyInput.value);

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

const findPhraseErrors = (phraseArg) => {
  const phrase = normalizeString(phraseArg);
  const words = phraseToWordArray(phrase);
  // Detect blank phrase
  if (words.length == 0) {
    return 'Blank mnemonic';
  }
  // Check each word
  for (let i = 0; i < words.length; i++) {
    var word = words[i];
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

// const phraseChanged = () => {
//   // Get the mnemonic phrase
//   const phrase = normalizeString(DOM.bip39Phrase.value);
//   const errorText = findPhraseErrors(phrase);
//   showValidationError(errorText);
//   if (errorText) {
//     return;
//   }
//   // Calculate and display
//   var passphrase = DOM.bip39Passphrase.value;
//   // calcBip32RootKeyFromSeed(phrase, passphrase);
//   // calcForDerivationPath();
//   // calcBip85();
//   // Show the word indexes
//   showWordIndexes();
//   writeSplitPhrase(phrase);
// };

const entropyChanged = async () => {
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
      mnemonicToSeedPopulate();
    }
  } else {
    // hidePending();
  }
  textareaResize();
};

const entropyTypeChanged = () => {
  entropyTypeAutoDetect = false;
  entropyChanged();
};

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
  const reqWords = parseInt(DOM.entropyMnemonicLengthSelect.value);
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
  showWordIndexes();
  showChecksum();
  writeSplitPhrase();
};

const hash = async (text, algo = 'SHA-256') => {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest(algo, msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex;
};

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
  let hex = await hash(entropyStr);
  // make sure the hash is at least 64 chars long
  // It should be but just in case
  while (hex.length % 64 !== 0) {
    hex = `0${hex}`;
  }
  const end = hex.length - (mnemonicLength * 8) / 3;
  const hexedBin = hex.slice(0, end);
  // Convert entropy array to mnemonic
  const phrase = window.bip39.entropyToMnemonic(hexedBin);
  // Set the mnemonic in the UI
  DOM.bip39Phrase.value = phrase;
  writeSplitPhrase();
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

const phraseToWordArray = () => {
  const phrase = normalizeString(DOM.bip39Phrase.value);
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

const showWordIndexes = () => {
  const words = phraseToWordArray();
  const wordIndexes = [];
  words.forEach((word) => {
    wordIndexes.push(wordList.indexOf(word));
  });
  const wordIndexesStr = wordIndexes.join(', ');
  DOM.entropyWordIndexes.innerText = wordIndexesStr;
};

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

const generateNewMnemonic = () => {
  toast('Calculating...');
  const numWords = parseInt(DOM.generateRandomStrengthSelect.value);
  const strength = (numWords / 3) * 32;
  const mnemonic = bip39.generateMnemonic(strength);
  DOM.bip39Phrase.value = mnemonic;
  // DOM.knownInputTextarea.value = mnemonic;
  mnemonicToSeedPopulate();
};

const writeSplitPhrase = async () => {
  const phrase = DOM.bip39Phrase.value;
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
    hackTime = Math.floor(hackTime) + ' seconds';
    displayRedText = true;
  } else if (hackTime < 31557600) {
    hackTime = Math.floor(hackTime / 86400) + ' days';
    displayRedText = true;
  } else {
    hackTime = Math.floor(hackTime / 31557600) + ' years';
  }
  DOM.bip39PhraseSplitWarn.innerText =
    'Time to hack with only one card: ' + hackTime;
  if (displayRedText) {
    DOM.bip39PhraseSplitWarn.classList.add('warning');
  } else {
    DOM.bip39PhraseSplitWarn.classList.remove('warning');
  }
};

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
  adjustPanelHeight();
  if (bip32RootKey) {
    calculateAddresses();
    fillBip32Keys();
    calcBip85();
    calcBip47();
  }
  textareaResize();
}, 1000);

const resetEverything = () => {
  seed = null;
  bip32RootKey = null;
  myPayCode = null;
  bobPayCode = null;
  DOM.bip32RootKey.value = '';
  if (!DOM.bip39Phrase.readOnly) {
    DOM.entropyInput.value = '';
  }
  clearEntropyFeedback();
  DOM.bip39PhraseSplit.value = '';
  DOM.bip39Seed.value = '';
  DOM.pathAccountXprv.value = '';
  DOM.pathAccountXpub.value = '';
  DOM.bip85Application.value = 'bip39';
  DOM.bip85MnemonicLength.value = '12';
  DOM.bip85Bytes.value = '64';
  DOM.bip85Index.value = '0';
  DOM.bip85ChildKey.value = '';
  DOM.bip47MyPaymentCode.value = '';
  DOM.bip47MyNotificationAddress.value = '';
  DOM.bip47MyNotificationPrvKey.value = '';
  DOM.bip47MyNotificationPubKey.value = '';
  DOM.bip47CPPaymentCode.value = '';
  DOM.bip47CPNotificationAddress.value = '';
  DOM.bip47CPNotificationPubKey.value = '';
};

const clearEntropyFeedback = () => {
  DOM.entropyTimeToCrack.innerText = '...';
  DOM.entropyEventCount.innerText = '...';
  DOM.entropyEntropyType.innerText = '...';
  DOM.entropyBitsPerEvent.innerText = '...';
  DOM.entropyRawWords.innerText = '...';
  DOM.entropyTotalBits.innerText = '...';
  DOM.entropyFiltered.innerText = '...';
  DOM.entropyRawBinary.innerText = '...';
  DOM.entropyBinaryChecksum.innerText = '...';
  DOM.entropyWordIndexes.innerText = '...';
  // DOM.entropyMethod.value = 'hex';
};
