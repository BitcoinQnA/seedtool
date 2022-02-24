/**
 * Setup the DOM for interaction
 */
window.addEventListener('DOMContentLoaded', () => {
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
