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
