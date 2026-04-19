window.showMessage = function(text, type) {
  var el = document.getElementById('message');
  if (!el) return;
  el.textContent = text;
  el.className = 'message ' + type;
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 3000);
};

document.addEventListener('DOMContentLoaded', function() {
  var tavilyInput = document.getElementById('tavilyKey');
  var geminiInput = document.getElementById('geminiKey');
  var saveBtn     = document.getElementById('saveBtn');

  if (!saveBtn) return;

  // Wczytanie zapisanych kluczy
  chrome.storage.sync.get(['tavilyApiKey', 'geminiApiKey'], function(result) {
    if (result.tavilyApiKey && tavilyInput) tavilyInput.value = result.tavilyApiKey;
    if (result.geminiApiKey && geminiInput) geminiInput.value = result.geminiApiKey;
  });

  // Zapis kluczy
  saveBtn.addEventListener('click', function() {
    var tavilyTyped = tavilyInput ? tavilyInput.value.trim() : '';
    var geminiTyped = geminiInput ? geminiInput.value.trim() : '';

    var toSave = {};
    if (tavilyTyped) toSave.tavilyApiKey = tavilyTyped;
    if (geminiTyped) toSave.geminiApiKey = geminiTyped;

    chrome.storage.sync.set(toSave, function() {
      if (chrome.runtime.lastError) {
        window.showMessage('Błąd zapisu: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      window.showMessage('Ustawienia zapisane!', 'success');
      setTimeout(function() { window.close(); }, 1500);
    });
  });
});