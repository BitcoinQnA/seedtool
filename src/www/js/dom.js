/**
 * Setup the DOM for interaction
 */
window.addEventListener('DOMContentLoaded', () => {
  // Accordion Sections
  document.querySelectorAll('.accordion').forEach((btn) => {
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
  // Make sure that the addressList tab is open
  // document.querySelectorAll('address-tab-links--default').forEach((element) => {
  //   element.click();
  // });
  // Setup one click copy
  document.querySelectorAll('.one-click-copy').forEach((textElement) => {
    textElement.addEventListener('click', (event) => {
      event.preventDefault();
      const text = textElement.innerText || textElement.value;
      copyTextToClipboard(text);
    });
  });
  // Add event listener for displaying/hiding entropy details
  const entropyDisplay = document.querySelector('input[id="entropyDetails"]');
  entropyDisplay.addEventListener('click', () => {
    displayEntropy(entropyDisplay.checked);
  });
  // add fake csv for testing
  injectAddresses(testAddressData, 'bip32');
});
// Event handler for switching tabs
window.tabSelect = (event, tabId) => {
  document.querySelectorAll('.tabContent').forEach((contentElement) => {
    contentElement.style.display = 'none';
  });
  document.querySelectorAll('.tabLinks').forEach((tabLink) => {
    tabLink.classList.remove('tab--active');
  });
  document.getElementById(tabId).style.display = 'block';
  event.currentTarget.classList.add('tab--active');
  adjustPanelHeight();
};
/**
 * QnA Explains dialog / Modal
 */
const infoModal = document.getElementById('infoModal');
const infoModalText = document.getElementById('infoModalText');
/**
 * Hide the modal and clear it's text
 */
const clearInfoModal = () => {
  infoModal.style.display = 'none';
  infoModalText.innerHTML = '';
};
/**
 * Open the QnA Explains dialog
 * @param {Event} _event Not used
 * @param {string} section string for the key to get value from info.js
 */
window.openInfoModal = (_event, section) => {
  infoModalText.innerHTML = window.infoHtml[section];
  infoModal.style.display = 'block';
};
/**
 * Function to close the dialog when user clicks on the outside
 * @param {Event} event Click Event on area outside the dialog
 */
window.onclick = function (event) {
  if (event.target == infoModal) {
    clearInfoModal();
  }
};
/**
 * If navigator.clipboard is not available, here is fallback
 * @param {string} text text to copy
 */
function fallbackCopyTextToClipboard(text) {
  var textArea = document.createElement('textarea');
  textArea.value = text;

  // Avoid scrolling to bottom
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    var successful = document.execCommand('copy');
    var msg = successful ? 'successful' : 'unsuccessful';
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
  const toastMessage = document.getElementById('toast');
  toastMessage.innerText = message || 'ERROR: Unknown Message';
  toastMessage.classList.add('show-toast');
  const background = document.getElementById('toast-background');
  background.classList.add('show-toast');
  setTimeout(() => {
    toastMessage.classList.remove('show-toast');
    background.classList.remove('show-toast');
  }, 3000);
}
/**
 * Display / Hide Entropy details
 * @param {boolean} checked Is the checkbox checked
 */
function displayEntropy(checked) {
  const container = document.getElementById('entropyDetailsContainer');
  if (checked) {
    // show details
    container.style.display = 'flex';
  } else {
    container.style.display = 'none';
  }
  adjustPanelHeight();
}
/**
 * Whenever some CSS changes in an accordion panel, call this to fix the panel
 */
function adjustPanelHeight() {
  document.querySelectorAll('.panel').forEach((panel) => {
    const isActive = panel.classList.contains('accordion-panel--active');
    if (isActive) {
      panel.style.maxHeight = panel.scrollHeight + 'px';
    } else {
      panel.style.maxHeight = null;
    }
  });
}
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
  const a = document.querySelector('.bip32-csv-download-link');
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
  });
  a.href = `data:text/csv;charset=utf-8,${encodeURI(csv)}`;
};

// Just here for testing
const testAddressData = [
  [
    "m/0/0'",
    '34qM2FbbmMe8w8DZouYb4HGEww2GEMWMNB',
    '02d495d2ff0d2fb6a34b34574a5bb183ec114d8d779a150fb162e4c86354b0c067',
    'L3WoSen5k7GLiC1jYKhcYSgeABxJFkdvAusf9sXqUYn1z7zYY7E1',
  ],
  [
    "m/0/1'",
    '3Gpnp8eAyW6kGXjWW2bfiapGntsCzaA2vS',
    '02e075430a31735e1d6cb519b66583004ed8c840751dabf8e93e419d24ec3ed370',
    'L4aoEi1YUWSFcZLi7FWGVsWuJTRojxs4NLqUV77JJDdf86vTrgnp',
  ],
  [
    "m/0/2'",
    '37gxJxEv3yDeFF8j61KwkWKnQ5w3LYEqpK',
    '0283ffadb8b1490444f7dc9aa6e81c6bcc208c01132c2b13414737f14154ea3e07',
    'L3hed6nd5j5GsSu9dxijdRBEKFEVxCnJw6tMyi5MpdRczuj5rPwr',
  ],
  [
    "m/0/3'",
    '3AU4UvTYUVdwdYKKRPhcRKCQfTR2wi8ZMh',
    '02fb292efc5ff8f3502a569584ba09669d58ed868abd2fb2abf22c0e67e87000cd',
    'Kxy9z6G97aqWWVj1DVjxfoem5nMzmBKNntQ8rhpTm4RL6e9d3woX',
  ],
  [
    "m/0/4'",
    '3HHmwveSxCaXWrwCHjJq9KfGLg6RB1NFZK',
    '03ef443469065186e7293176a7b6ff0627f201c3963bd6ad56749c3fadd50e3cad',
    'L1RFfC3uGmQGALkqKehjc75ZKCk4UDUUFHtH9vVickHuxmGYyP8z',
  ],
  [
    "m/0/5'",
    '39wsi8gPty2KvX2DBedMxLxuLB6JWmebxt',
    '0396c3b7e0fe52b469ee96b0d73e409dfda468e25bc9b5255ac6f065cd395bf1c9',
    'KyS4Com4huWJeiM3hKeKx3qFSnHdiDiWpXixCZ9PWFxz5JcMRM47',
  ],
  [
    "m/0/6'",
    '3PAAdUDWXxTKCqixppTVie6hyY5Awo3mxo',
    '03785808e14d64aa3ef71a7af2e0d32193d103ffe684cc8d293ef0a40d898a2db4',
    'L1KzUunuakqUmyH4dL2MtQtMF56iYW5XrnE2U7o4GUVZoauqCNTa',
  ],
  [
    "m/0/7'",
    '3EAaG2EHsdHequwA1NnKq6ZcFn2tnrSjFD',
    '03ff25afe787a503174955a35585fce67acd8f0be9426661542595be27adbe1656',
    'KyS9eCY5uFk9qWFQc646vPXRhDyU2G6S4JwVZZioeDjfKxSSUHRF',
  ],
  [
    "m/0/8'",
    '38pJsLEcmpXyHQK1bGs8H9f7Wx4ynjUS41',
    '036e7328f6c72fb8210031a643e92b7c03c9e0b4ba3e939737ad2dd570735cbea6',
    'L4xeThw5t8gbteWxc2vGFsvKCoNYSATZqbKhFxrik9M2ApfaiSsK',
  ],
  [
    "m/0/9'",
    '3DnCFKTFjoaErqQENWJYCGq3P3Y5Eyda6W',
    '03d1e055e639eaacb209d7c1ce8de668e5a8c95aca20cd88526ba0ef8bee835d4c',
    'KwTadhVfmYvYRiP9y1B4ERhH6z31KHT2UDnrojAmpbWr5wTiyThu',
  ],
  [
    "m/0/10'",
    '3MnBBFZwQXWP3mJDwLKA2qWM9F9Bibmu5Q',
    '02524d3ffa707155f4eee4917abe05f92a02ef9b4f389be250f6a201d86cc1d1ce',
    'KwG88oJPQPC1t9c3tFbLGWp6GV1Qhj56PHdT2ndPkzvg8AsNufBC',
  ],
  [
    "m/0/11'",
    '32LKrxNx9SUVSNqoB8kAyAbtcgnL6sHPXC',
    '03694ed10e18d7c2dbd6fd40de9f2b8cbaa4d9f710c82deccb0843eb3dace98e6c',
    'KzsxsjcrbwFu6CcTCkrZK5z4SVW3qTMAK2hvw2yBmyPa5nkGmNDR',
  ],
  [
    "m/0/12'",
    '3MYwiNGi41u1tAdMHN91sYXjopEYxuTxyM',
    '02a2f1512ca1577fcfcccab9065e8f70eb92891f38b63e7e7797287361590aa8fc',
    'L5Wei9MUUuY9eRUeDVMep7W6gARkWfqsCzXv51WzNf55cgpf7G99',
  ],
  [
    "m/0/13'",
    '38aWe89t6EgnJ2bxi7gaGj7BnbkXat56Sj',
    '0235bf5aa3a6f93eb8c8c40aa975434dc46b2ac80e554c7806ee3f5a23061372e4',
    'L1VwCyVrLdAvHaHGNHJs1rrXPbaaUqKt7LrcVwPFtvr1HLKiHGuU',
  ],
  [
    "m/0/14'",
    '3KK4grbpuSLGdrizFsgdCs3FUb8pE6T6nU',
    '02345ceed3e372c030290357fcc0f1865a23d9c3c49748d5830f614e446227c3ec',
    'Kxw9hjkbpe6ZLLo28TBw44HtMyPK4sfr6bbxWm3fmva7XLcxwN3K',
  ],
  [
    "m/0/15'",
    '3PtEGKMALLR6DLVHhNfQXLAm3XSXuemQ5c',
    '0394f45cbde7d64e5efbcedc8e14502d10a8f9a5013d0594ea351df2d16feb8c8f',
    'L392Kfu8NcyvvxMXpuvNJNQDufi2T6XxtqCUXcL87EAMPxnKNgUb',
  ],
  [
    "m/0/16'",
    '31pxcX2cGrywn1bLREyStXmvC4VWqtT2wQ',
    '024753ed20e42e8c80e57a75cad3aac861439b66111bb2966189bd35fc16996521',
    'L2xiH82mfn82Pnx4qR38EomMxzdBpgNdeMJ4FmBEiULLgHQLT6Vo',
  ],
  [
    "m/0/17'",
    '32Kdqyt8ZQtGXCtNLtrZMWq1SyvkZ8cG5P',
    '0312ff1f91593fd816ec3e077650f2dc40be2f88cc6e4e980694c802f472b8bd77',
    'Kx4u1Q7Mqo8nbXHPgZEdYQ6uPH2dkC5UWrokDNbBijAMXBHW2YRr',
  ],
  [
    "m/0/18'",
    '3PHPkwrg6VeHgt4EExGQ27MkTpQ5UWkARs',
    '02eed0eb90f0a1b1f0f6fb407bb5dde050028d43f9b7f776f39b87289accb72894',
    'KwxnigneKvnvaHEEB5afnCAGQG7QJiBc2Wv4zPqpspqzmJ5TUbkE',
  ],
  [
    "m/0/19'",
    '3Q2iswzEzkd6YCLpiZFeZEFByTbhyExPsk',
    '0229f3f9fb1cba94c11711a26b34a4f48d1bc6ed967b1cebd8f66229c2522115b0',
    'L3WkN5kqLfJmZWvF2nTw2Bcqh9HviYrAv5v3MiD1rdnwYoz8nK3M',
  ],
  [
    "m/0/20'",
    '3NWSsRmJkcCCdRvQMQD413LMqoBuRzg4xz',
    '02dc2a9fc672319254a533419a081a82b62f5cb9f75a75b10a1d991159a7d72318',
    'KwcCp83vaRcvvzN7DcBUafjtUjDhd86gVJXKU2F7SjqThnQEnvUm',
  ],
  [
    "m/0/21'",
    '3Jv3hQE9aKpsHzSBGUdW7QUqNqupXjpsTj',
    '0249f83261fe2c183b00c53dbbd370675817db4794e0b252a3f3835299ae17ea7e',
    'L5KDUfnArCMqnUqWPB8zDzEsc6qwKgpMSGG8u2YRv46L5g8KL2cu',
  ],
  [
    "m/0/22'",
    '3HhaPgxAENh8zac7ECKGns1yVLUqwao1an',
    '0217d9efc8664ba6429fb05298bf6fef3bc9b3b652d668dc04c7f0d72dc1551e82',
    'L2tjJPmu7BVKewxd91ePQenYJLbuvwQoPnk7vNGcej6zkocuwNw3',
  ],
  [
    "m/0/23'",
    '3BFwPxZqyX5T7hQMa1PaiceUYWs4PxkuL4',
    '03a39b2ca93dafb6a58a86b88f012d30175edeff3cfbc53a25471b3811c120b59e',
    'L1HBmmAZhZ6sx4KoWqZYWy7Qsu4Eo6Wz9zJQ9RNwszNgdHbuf2ge',
  ],
  [
    "m/0/24'",
    '3FYuCduBLVw3kGrf3gerUVaw5ovbzSZPdF',
    '02e48efda298d56a2d1a25e1f9e0c5f7960fab7e0e334ea0c84ef6239de0a0ca85',
    'L4FRedEbrcwzHhv2wAdAptT2JYrXpNdguT5mJ6Snp8yqa5Ur9SKB',
  ],
  [
    "m/0/25'",
    '38cb3962UeASs17Z9TNQbgzfvxPxvBypxd',
    '020b77fea0ba86fa23a946a8b3655932862dba7e965207b192eb62c5898de7178d',
    'L1wSh2uS3XwCzcG8B2kTyHWM8uKcys5cuCqfSPRQqdFsR779KNCw',
  ],
  [
    "m/0/26'",
    '3C96oTCA9LPwa3dLRhE3vD6YwiVXezNchV',
    '03dcf359dc3d353573b7f185497b5c6a32638fccc179c6002abd69abde807cb107',
    'L3p8hj1CDkHkieoZMogH1tQ8Yo7PG8ujbLbu4oRAomxFMY2yjzf7',
  ],
  [
    "m/0/27'",
    '3JbctpfKF8oko5MRM1PRUWHCgkpoqMzBif',
    '025158f54f17773d1fc85b18357eb39dc7a113cee13732541125bf2f98c7eb6f79',
    'KzTTeLkiH6zCPaYDvcLQMYxJHN46ZDMbXJvyAKEzBNc4SNqG2pcK',
  ],
  [
    "m/0/28'",
    '37Sqc8Qy572k3kcd2MGeACv2VyFP23Xn81',
    '03fa97d5418d654067aa9ac0c3b7370b3ca0e4ba6b9dd07e589d0a5624eb987f87',
    'L3QWBPquznxSaKCS26cHeo96bQDpeDgr2hcAk63YGSC5ZEJ2km2T',
  ],
  [
    "m/0/29'",
    '38GfQE3LtNt5tyYtLof5S7TTDjP8NExaGZ',
    '0262f4913b34a79b1658320aa3ccbf66d82af7e767849ad328b54d44d1627378f9',
    'L44Aeys7Qt2CpuDkqS9SX7JyqFRQdQzG8nxfcrnGjva7A2qTQuAF',
  ],
  [
    "m/0/30'",
    '33oKAAZ3mL575xb3HA5j1xiJ14HcdBtAeA',
    '0394aa8eded9036caad494c90e24f5ac3bd8622c26aaeff82239bae6f398312431',
    'L4R5a9v5jM28dLjebS6foYbKwt9DNxipkwtWL4WLCJEgRFmzxkdM',
  ],
  [
    "m/0/31'",
    '3ALwjabq4g51XzHPjarwkJU8pG2tF5JL69',
    '02085ccf030cade366404d5d66b7529e53af2b69a83bd839d798627dc9aa685b16',
    'KyhbLzkPrqkLoiisXfm1G4xaCK5QUS3U82u5NfGSGpknJ5hEP8cr',
  ],
  [
    "m/0/32'",
    '3H87Qb7rYsk2eCXPr4fjqRHpXgUFdbKnzA',
    '02de087f4608e794a2b2ff6e72d3f578c9a68c9d0afc54cc0002992e9be2cef360',
    'KwwJ1qgAY7WAk19BdrYHup96V3bboUx2phtjf9tPrHbdpxDDJ4Nk',
  ],
  [
    "m/0/33'",
    '33Y6QK8YVccL6ZCpuY1PNQGhQPiA56nNyD',
    '02108cf1524c99a60f32ac14b0850e7a138bc69811e554ef4c767d9f569b9c885a',
    'KyYuSBQvCqgqC5b6GLQXkt8dhU7s3tkn5jgbD1523YVnBYyhevcU',
  ],
  [
    "m/0/34'",
    '3QDc4CtLxaEf1WhgqcoqCGZrtzp7tsqxEP',
    '029498e7e87421e101ed4a84ec5370133438a908557945e5474715640e9ccc959f',
    'Kz2DAZMW3XFzdjsyuG6EMtLvCwCUYkr7oV9pqqEtsNZbTdrRrMzh',
  ],
  [
    "m/0/35'",
    '3MecEsQBrSo6j278ZGoc9PxSTupEMu6zsy',
    '036e23e2603140ecefa41cdfbf68313c7217229ec39117915c4e5e6171b62b8ec2',
    'L1qcorUaABpwKf2x9gcT8LykwX6FAjnMrqG7qZBF73Lss31LJiUB',
  ],
  [
    "m/0/36'",
    '3GdYEUPwTEmjyYKu4qpBnEu6VTEFWs29gH',
    '02e9c09b68f59f3640ebc6459b0070339c687c29e50844f8e706123b2b94d178bd',
    'KwoFpBrMSoFw5Cm4TMCt5TYBNd2thqQ8s6yr5iNBfLWgDH9YicdH',
  ],
  [
    "m/0/37'",
    '34zbQbpUbtDMWrb9zF5Q5XF7qSUTVZe3MX',
    '021a0d2ddf4ae46d1cb234e48b51b72a0c47a831a462142f37f9e1e5b32366cebc',
    'Kywu7v4oRnLKJaJkP1MJ95tszJKLuy882wgbkD2TP33GJhVA645e',
  ],
  [
    "m/0/38'",
    '3LyZzFD7FoPbCeowjmHrcofTsaxx5V9CGj',
    '02803c9387f692835b4870163a5136b1b8dec0f6510ae2ec61c99bb083862afc93',
    'Kx66EYc2CUKD1CVB5Y8zWSJPGdJjziqoyPyecYinwcZcBETw19zH',
  ],
  [
    "m/0/39'",
    '3NrfFZpVZyUNugrE55PegQK2AdSdmd1ALm',
    '0265150af0d46d0aa486df5dbf57369e5d59925ac7db8a70d1a8a61fcd81888fd3',
    'L2f6J3CMdoGqEZP55z4T3GhiCz2kXHpSVCKwQcxt88GuRLygHivh',
  ],
].map((a) => new AddressData(a[0], a[1], a[2], a[3]));
