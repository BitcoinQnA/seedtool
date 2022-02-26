/**
 * Setup the DOM for interaction
 */
window.addEventListener('DOMContentLoaded', () => {
  // Accordion Sections
  const accordionSections = document.getElementsByClassName('accordion');
  for (let i = 0; i < accordionSections.length; i++) {
    const section = accordionSections[i];
    section.addEventListener('click', () => {
      section.classList.toggle('active');
      const panel = section.nextElementSibling;
      if (panel.style.maxHeight) {
        panel.style.maxHeight = null;
      } else {
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  }
  // FOOTER: calculate copyright year
  const yearSpan = document.getElementsByClassName('cYear');
  for (let i = 0; i < yearSpan.length; i++) {
    let output = '';
    const currentYear = new Date().getFullYear();
    const originYear = parseInt(yearSpan[i].innerHTML);
    if (currentYear - originYear > 10) {
      output = '&nbsp;-&nbsp;' + originYear + 10;
    } else if (currentYear !== originYear) {
      output = '&nbsp;-&nbsp;' + currentYear;
    }
    yearSpan[i].innerHTML += output;
  }
  document.getElementById('defaultOpenTab').click();
  seedGenPanel.style.maxHeight = null;
  // Setup one click copy
  document.querySelectorAll('.one-click-copy').forEach((textElement) => {
    textElement.addEventListener('click', () => {
      const text = textElement.innerText || textElement.value;
      copyTextToClipboard(text);
    });
  });
});
const seedGenPanel = document.getElementById('seedGenPanel');
window.tabSelect = (event, tabId) => {
  const contentElements = document.getElementsByClassName('tabContent');
  for (let i = 0; i < contentElements.length; i++) {
    contentElements[i].style.display = 'none';
  }
  const tabLinks = document.getElementsByClassName('tabLinks');
  for (i = 0; i < tabLinks.length; i++) {
    tabLinks[i].classList.remove('active');
  }
  document.getElementById(tabId).style.display = 'block';
  event.currentTarget.classList.add('active');
  seedGenPanel.style.maxHeight = seedGenPanel.scrollHeight + 'px';
};

const infoModal = document.getElementById('infoModal');
const infoModalText = document.getElementById('infoModalText');
const clearInfoModal = () => {
  infoModal.style.display = 'none';
  infoModalText.innerHTML = '';
};
// document.getElementById('infoModalClose').onclick(clearInfoModal);
/**
 * Open the QnA Explains dialog
 * @param {Event} _event Not used
 * @param {string} section string for the key to open from info.js
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
  toastMessage.className = 'show-toast';
  setTimeout(() => {
    toastMessage.classList.remove('show-toast');
  }, 3000);
}
