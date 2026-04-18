// Load localized messages
document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('saveBtn');
  const message = document.getElementById('message');
  const apiKeyLabel = document.getElementById('apiKeyLabel');

  // Set localized text
  apiKeyLabel.textContent = 'Google API Key:';
  apiKeyInput.placeholder = chrome.i18n.getMessage('apiKeyPlaceholder');
  saveBtn.textContent = chrome.i18n.getMessage('saveButton');

  // Load saved API key
  const result = await chrome.storage.sync.get(['googleApiKey']);
  if (result.googleApiKey) {
    apiKeyInput.value = result.googleApiKey;
  }

  // Save API key
  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showMessage(chrome.i18n.getMessage('error'), 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ googleApiKey: apiKey });
      showMessage(chrome.i18n.getMessage('apiKeySaved'), 'success');
      
      // Close popup after 1.5 seconds
      setTimeout(() => {
        window.close();
      }, 1500);
    } catch (error) {
      showMessage(chrome.i18n.getMessage('error') + ': ' + error.message, 'error');
    }
  });

  function showMessage(text, type) {
    message.textContent = text;
    message.className = 'message ' + type;
    message.style.display = 'block';
    
    setTimeout(() => {
      message.style.display = 'none';
    }, 3000);
  }
});