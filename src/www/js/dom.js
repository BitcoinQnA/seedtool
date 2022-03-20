// mnemonics is populated as required by getLanguage
// const mnemonics = { english: new Mnemonic('english') };
// const mnemonic = mnemonics['english'];
let seed = null;
let bip32RootKey = null;
let bip32ExtendedKey = null;
// let network = bitcoin.networks.bitcoin;
let wordList = [];
let showIndex = true;
let showAddress = true;
let showPubKey = true;
let showPrivKey = true;
let showQr = false;

let entropyTypeAutoDetect = true;
let entropyChangeTimeoutEvent = null;
let phraseChangeTimeoutEvent = null;
let seedChangedTimeoutEvent = null;
let rootKeyChangedTimeoutEvent = null;

const generationProcesses = [];
/**
 * Setup the DOM for interaction
 */
const DOM = {};
const setupDom = () => {
  DOM.accordionButtons = document.querySelectorAll('.accordion');
  DOM.accordionPanels = document.querySelectorAll('.panel');
  DOM.allTabContents = document.querySelectorAll('.tabContent');
  DOM.allTabLinks = document.querySelectorAll('.tabLinks');
  DOM.generateRandomStrengthSelect = document.getElementById(
    'generateRandomStrength'
  );
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
  DOM.bip39Seed = document.getElementById('bip39Seed');
  DOM.bip39Invalid = document.querySelector('.bip39-invalid-phrase');
  DOM.bip39InvalidMessage = document.getElementById('bip39ValidationError');
  DOM.bip44Coin = document.getElementById('bip44Coin');
  DOM.bip44Account = document.getElementById('bip44Account');
  DOM.bip44Change = document.getElementById('bip44Change');
  DOM.bip44AccountXprv = document.getElementById('bip44AccountXprv');
  DOM.bip44AccountXpub = document.getElementById('bip44AccountXpub');
  DOM.bip44Path = document.getElementById('bip44Path');
  DOM.bip85Application = document.getElementById('bip85Application');
  DOM.bip85MnemonicLength = document.getElementById('bip85MnemonicLength');
  DOM.bip85Bytes = document.getElementById('bip85Bytes');
  DOM.bip85Index = document.getElementById('bip85Index');
  DOM.bip85ChildKey = document.getElementById('bip85ChildKey');

  // Show / hide split mnemonic cards
  DOM.bip39ShowSplitMnemonic.addEventListener('click', () => {
    if (DOM.bip39ShowSplitMnemonic.checked) {
      DOM.bip39SplitMnemonicSection.classList.remove('hidden');
    } else {
      DOM.bip39SplitMnemonicSection.classList.add('hidden');
    }
    adjustPanelHeight();
  });

  // listen for if entropy method changes
  DOM.entropyMethod.oninput = entropyTypeChanged;

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
    textElement.addEventListener('click', (event) => {
      event.preventDefault();
      const text = textElement.innerText || textElement.value;
      copyTextToClipboard(text);
    });
  });
  // add template for derived addresses
  addDerivedAddressBlocks();
  // add listener for bip44 path inputs
  DOM.bip44Coin.oninput = changeBip44Path;
  DOM.bip44Account.oninput = changeBip44Path;
  DOM.bip44Change.oninput = changeBip44Path;
  // Add event listener for displaying/hiding entropy details
  DOM.entropyDisplay.addEventListener('click', () => {
    displayEntropy(DOM.entropyDisplay.checked);
  });
  // add event listener for entropy
  DOM.entropyInput.oninput = entropyChanged;
  DOM.entropyMnemonicLengthSelect.oninput = entropyChanged;
  // add event listener for new mnemonic / passphrase
  DOM.bip39Passphrase.oninput = mnemonicToSeedPopulate;
  DOM.bip39Phrase.oninput = mnemonicToSeedPopulate;
  // Add event listener to generate new mnemonic
  DOM.generateButton.addEventListener('click', generateNewMnemonic);
  // Generate random seed words
  DOM.generateButton.click();
  // update pointer to word list
  wordList = bip39.wordlists[Object.keys(bip39.wordlists)[0]];
  // add fake csv for testing
  // injectAddresses(testAddressData, 'bip47');
  // injectAddresses(testAddressData, 'bip49');
  // injectAddresses(testAddressData, 'bip84');
};

// Run setupDom function when the page has loaded
window.addEventListener('DOMContentLoaded', setupDom);

function getAddress(node, network) {
  return bitcoin.payments.p2pkh({ pubkey: node.publicKey, network }).address;
}

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
    console.log('Fallback: Copying text command was ' + msg);
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
        console.log('Async: Copying to clipboard was successful!');
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
function displayEntropy(checked) {
  DOM.entropyDetailsContainer = document.getElementById(
    'entropyDetailsContainer'
  );
  if (checked) {
    // show details
    DOM.entropyDetailsContainer.style.display = 'flex';
  } else {
    DOM.entropyDetailsContainer.style.display = 'none';
  }
  adjustPanelHeight();
}
/**
 * Whenever some CSS changes in an accordion panel, call this to fix the panel
 */
function adjustPanelHeight() {
  DOM.accordionPanels.forEach((panel) => {
    const isActive = panel.classList.contains('accordion-panel--active');
    if (isActive) {
      panel.style.maxHeight = panel.scrollHeight + 'px';
    } else {
      panel.style.maxHeight = null;
    }
  });
}

const changeBip44Path = () => {
  const coin = DOM.bip44Coin.value;
  const account = DOM.bip44Account.value;
  const change = DOM.bip44Change.value;
  const path = `m/44'/${coin}'/${account}'/${change}`;
  DOM.bip44Path.value = path;
};
/**
 * Add derived address blocks to each section
 */
const addDerivedAddressBlocks = () => {
  const bips = ['bip32', 'bip44', 'bip47', 'bip49', 'bip84'];
  // Ensure not internet explorer!
  if (!('content' in document.createElement('template'))) {
    throw new Error(
      'Browser Outdated! Unable to populate address list and generate csv.'
    );
  }
  bips.forEach((bip) => {
    const container = document.querySelector('.derived-addresses-block-' + bip);
    const template = document.querySelector('#derivedAddressTemplate');
    const clone = template.content.firstElementChild.cloneNode(true);
    if (!container || !template || !clone) {
      console.error('Unable to insert Address block template for ' + bip);
      return;
    }
    const gen = clone.querySelector('button');
    gen.id = bip + 'GenerateBtn';
    gen.addEventListener('click', generateAddresses);
    const a = clone.querySelector('a');
    a.className = bip + '-csv-download-link';
    a.download = bip + '_addresses.csv';
    a.classList.add('hidden');
    clone
      .querySelector('.address-display-content')
      .classList.add(bip + '-address-display-content--list');
    container.appendChild(clone);
  });
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
   * @param {string} prvKey - The private key.
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
const injectAddresses = (addressDataArray, addressListName) => {
  // Init the csv string with the headers
  let csv = `path,address,public key,private key
`;
  // declare DOM elements
  const a = document.querySelector(`.${addressListName}-csv-download-link`);
  a.classList.remove('hidden');
  const listContainer = document.querySelector(
    `.${addressListName}-address-display-content--list`
  );
  const template = document.querySelector('#addressTemplate');
  // check we have the DOM elements
  if (!listContainer || !template || !a) {
    throw new Error(
      'Address container not found! Unable to populate list and generate csv.'
    );
  }
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
    listContainer.appendChild(clone);
    adjustPanelHeight();
  });
  a.href = `data:text/csv;charset=utf-8,${encodeURI(csv)}`;
};

const calculateAddresses = (bip, startIndex = 0, endIndex = 19) => {
  clearAddresses(bip);
  if (!bip32RootKey) {
    console.error('Unable to generate addresses while bip32RootKey is null');
    return;
  }
  const node = bip32RootKey;
  // console.log(seed);
  // if (!seed) {
  //   return;
  // }
  const path = {
    bip32: () => `m/0'/0'/`,
    bip44: () => DOM.bip44Path.value + '/',
    bip47: () => false,
    bip49: () => false,
    bip84: () => false,
    bip85: () => false,
    bip141: () => false,
  };
  if (!path[bip]()) {
    console.error('Unable to generate addresses without valid path');
    return;
  }
  // const node = bip32.fromSeed(seed);
  const addressDataArray = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const addressPath = path[bip]() + i + `'`;
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
  injectAddresses(addressDataArray, bip);
};

const generateAddresses = (event) => {
  event.preventDefault();
  const btn = event.target;
  const parentEl = btn.parentElement;
  const startIndex =
    parseInt(parentEl.querySelector('.address-start-index')?.value) || 0;
  const endIndex =
    parseInt(parentEl.querySelector('.address-end-index')?.value) || 19;
  const bip = btn.id.replace('GenerateBtn', '');
  calculateAddresses(bip, startIndex, endIndex);
};

const clearAddresses = (bip) => {
  const a = document.querySelector(`.${bip}-csv-download-link`);
  a.classList.add('hidden');
  const listContainer = document.querySelector(
    `.${bip}-address-display-content--list`
  );
  while (listContainer.firstChild) {
    listContainer.removeChild(listContainer.firstChild);
  }
  adjustPanelHeight();
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
};

const entropyTypeChanged = () => {
  console.log('entropyTypeChanged :>> ', 'entropyTypeChanged');
  entropyTypeAutoDetect = false;
  entropyChanged();
};

const calculateEntropy = async () => {
  const unknown = 'Unknown';
  const input = getEntropy();
  const entropy = window.Entropy.fromString(input);
  const eventCount = entropy.base.events.length;
  const numberOfBits = entropy.binaryStr.length;
  const wordCount = Math.floor(numberOfBits / 32) * 3;
  const bitsPerEvent = entropy.base.bitsPerEvent?.toFixed(2) || unknown;
  const biasedBits = Math.floor(bitsPerEvent * eventCount);
  const spacedBinaryStr = entropy.binaryStr
    ? addSpacesEveryElevenBits(entropy.binaryStr)
    : unknown;
  let timeToCrack = unknown;
  try {
    const z = window.zxcvbn(entropy.base.events.join(''));
    timeToCrack = z.crack_times_display.offline_fast_hashing_1e10_per_second;
    if (z.feedback.warning != '') {
      timeToCrack = timeToCrack + ' - ' + z.feedback.warning;
    }
  } catch (e) {
    console.log('Error detecting entropy strength with zxcvbn:');
    console.log(e);
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
  calculateEntropy(entropy);
  // Use biased bits to allow 99 dice roll
  const bits = Math.ceil(
    entropy.base.bitsPerEvent * entropy.base.events.length
  );
  console.log('bits :>> ', bits);
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
  const start = hex.length - (mnemonicLength * 8) / 3;
  const hexedBin = hex.slice(start);
  console.log('hexedBin :>> ', hexedBin);
  // Convert entropy array to mnemonic
  const phrase = window.bip39.entropyToMnemonic(hexedBin);
  // Set the mnemonic in the UI
  DOM.bip39Phrase.value = phrase;
  writeSplitPhrase();
  // Show the word indexes
  showWordIndexes();
  // Show the checksum
  showChecksum();
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

/**
 * Called when mnemonic is updated
 */
const mnemonicToSeedPopulate = debounce(() => {
  const mnemonic = getPhrase();
  const passphrase = getPassphrase();
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
  calculateEntropy();
  if (seed) {
    const node = bip32.fromSeed(seed);
    bip32RootKey = node;
  } else {
    bip32RootKey = null;
  }
  DOM.bip32RootKey.value = bip32RootKey ? bip32RootKey.toBase58() : 'unknown';
  adjustPanelHeight();
}, 1000);

const resetEverything = () => {
  seed = null;
  bip32RootKey = null;
  DOM.bip32RootKey.value = '';
  if (!DOM.bip39Phrase.readOnly) {
    DOM.entropyInput.value = '';
  }
  clearEntropyFeedback();
  DOM.bip39PhraseSplit.value = '';
  DOM.bip39Seed.value = '';
  DOM.bip44AccountXprv.value = '';
  DOM.bip44AccountXpub.value = '';
  DOM.bip85Application.value = 'bip39';
  DOM.bip85MnemonicLength.value = '12';
  DOM.bip85Bytes.value = '64';
  DOM.bip85Index.value = '0';
  DOM.bip85ChildKey.value = '';
  ['bip32', 'bip44'].forEach((bip) => clearAddresses(bip));
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
