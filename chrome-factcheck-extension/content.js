// Content script for handling text selection and interaction
// This script runs on all web pages

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    const selectedText = window.getSelection().toString().trim();
    sendResponse({ text: selectedText });
  }
  return true;
});

// Optional: Add visual feedback when text is selected
let lastSelection = '';

document.addEventListener('mouseup', () => {
  const selection = window.getSelection().toString().trim();
  if (selection && selection !== lastSelection) {
    lastSelection = selection;
    // Could add visual indicators here if needed
  }
});

document.addEventListener('mousedown', () => {
  lastSelection = '';
});

console.log('FactCheck AI content script loaded');
