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
const setupDom = () => {
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
  DOM.bip32RootFingerprint = document.getElementById('bip32RootFingerprint');
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
  DOM.bip39ToolSelect = document.getElementById('bip39ToolSelect');
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
  DOM.showHide = document.getElementById('showHide');
  DOM.onlineIcon = document.getElementById('networkIndicator');
  DOM.infoModal = document.getElementById('infoModal');
  DOM.infoModalText = document.getElementById('infoModalText');
  // set network now
  network = bitcoin.networks.bitcoin;
  // BIP39 Tool select
  DOM.bip39ToolSelect.oninput = selectBip39Tool;
  DOM.bip39PassTestBtn.onclick = bip39PassphraseTest;
  // CHECKBOXES
  // // Show / hide split mnemonic cards
  // DOM.bip39ShowSplitMnemonic.oninput = bip39ShowSplitMnemonic;
  // // Show / hide Passphrase Generation
  // DOM.hidePassphraseGeneration.oninput = hidePassphraseGeneration;
  // // Show / hide Passphrase Tester
  // DOM.hidePassphraseTest.oninput = hidePassphraseTest;
  // hide private data
  DOM.showHide.onclick = toggleHideAllPrivateData;
  // call these now in case checkbox is not in expected state
  // e.g. user navigates back to site from another page
  // bip39ShowSplitMnemonic();
  // hidePassphraseGeneration();
  // hidePassphraseTest();
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
  // listen for bip85 changes
  DOM.bip85Application.oninput = calcBip85;
  DOM.bip85MnemonicLength.oninput = calcBip85;
  DOM.bip85Bytes.oninput = calcBip85;
  DOM.bip85Index.oninput = calcBip85;
  DOM.bip85LoadParent.onclick = bip85LoadParent;
  DOM.bip85LoadChild.onclick = bip85LoadChild;
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
  // Watch for changes in the window size to change textarea boxes
  resizeObserver.observe(document.querySelector('body'));
  // open the about panel on load
  DOM.aboutPanel.click();
  // Remove loading screen
  document.getElementById('loadingPage').style.display = 'none';
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

// Show/Hide all private data
const toggleHideAllPrivateData = (panelHeightAdjustNotRequired) => {
  hidePrivateData = !hidePrivateData;
  document.getElementById('hideIcon').classList.toggle('hidden');
  document.getElementById('showIcon').classList.toggle('hidden');
  document.querySelectorAll('.private-data').forEach((el) => {
    el.style.display = hidePrivateData ? 'none' : '';
  });
  if (!panelHeightAdjustNotRequired) adjustPanelHeight();
};

// Select a BIP39 Tool
const selectBip39Tool = () => {
  document
    .querySelectorAll('.bip39ToolSection')
    .forEach((s) => s.classList.add('hidden'));
  const section = document.getElementById(DOM.bip39ToolSelect.value);
  if (section) {
    section.classList.remove('hidden');
  }
  adjustPanelHeight();
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

/**
 * Test if a payment code is valid
 * @param {string} paymentCode Base58 encoded string of the payment code
 * @returns {boolean}
 */
const isValidPaymentCode = (paymentCode) => {
  try {
    bip47.fromBase58(paymentCode, network);
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
  bobPayCode = bip47.fromBase58(bobPcBase58, network);
  const bobNotifyPubKey = bobPayCode.derive(0).publicKey;
  const bobNotifyAddress = bobPayCode.getNotificationAddress();
  DOM.bip47CPNotificationAddress.value = bobNotifyAddress;
  DOM.bip47CPNotificationPubKey.value = bobNotifyPubKey.toString('hex');
  calculateBip47Addresses();
  adjustPanelHeight();
  fetchRobotImages();
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
  if (hidePrivateData) {
    hidePrivateData = false;
    toggleHideAllPrivateData(true);
  }
  DOM.bip47CsvDownloadLink.href = `data:text/csv;charset=utf-8,${encodeURI(
    csv
  )}`;
  adjustPanelHeight();
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
function adjustPanelHeight() {
  textareaResize();
  DOM.accordionPanels.forEach((panel) => {
    panel.style.maxHeight = panel.classList.contains('accordion-panel--active')
      ? panel.scrollHeight + 'px'
      : null;
  });
}

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
  if (hidePrivateData) {
    hidePrivateData = false;
    toggleHideAllPrivateData(true);
  }
  DOM.csvDownloadLink.href = `data:text/csv;charset=utf-8,${encodeURI(csv)}`;
  adjustPanelHeight();
};

// get derived addresses and pass them off to be inserted in DOM
const calculateAddresses = (startIndex = 0, endIndex = 19) => {
  clearAddresses();
  if (!bip32RootKey) {
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
  DOM.bip32AccountXpub.value = bip32ExtendedKey.neutered().toBase58();
  if (currentBip !== 'bip32') {
    displayAccountKeys();
  }
};

// When currentBip isn't 32, display bip32 keys
const displayAccountKeys = () => {
  const purpose = DOM.pathPurpose.value;
  const coin = DOM.pathCoin.value;
  const account = DOM.pathAccount.value;
  const accountPath = `m/${purpose}'/${coin}'/${account}'`;
  const accountExtendedKey = bip32RootKey.derivePath(accountPath);
  DOM.pathAccountXprv.value = accountExtendedKey.toBase58();
  DOM.pathAccountXpub.value = accountExtendedKey.neutered().toBase58();
};

// Calculate and populate the BIP85 section
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
  const end = (mnemonicLength * 8) / 3;
  const hexedBin = hex.slice(0, end);
  // Convert entropy array to mnemonic
  const phrase = window.bip39.entropyToMnemonic(hexedBin);
  // Set the mnemonic in the UI
  DOM.bip39Phrase.value = phrase;
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

// Display the indexes of the mnemonic phrase
const showWordIndexes = () => {
  const words = phraseToWordArray();
  const wordIndexes = [];
  words.forEach((word) => {
    wordIndexes.push(wordList.indexOf(word));
  });
  const wordIndexesStr = wordIndexes.join(', ');
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

// Generate a random mnemonic when button is clicked
const generateNewMnemonic = () => {
  toast('Calculating...');
  const numWords = parseInt(DOM.generateRandomStrengthSelect.value);
  const strength = (numWords / 3) * 32;
  const mnemonic = bip39.generateMnemonic(strength);
  DOM.bip39Phrase.value = mnemonic;
  // DOM.knownInputTextarea.value = mnemonic;
  mnemonicToSeedPopulate();
};

// Split the mnemonic phrase over 3 cards
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
    calculateAddresses();
    fillBip32Keys();
    calcBip85();
    calcBip47();
  }
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
