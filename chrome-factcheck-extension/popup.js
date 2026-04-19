window.showMessage = function(text, type) {
  var el = document.getElementById('message');
  if (!el) return;
  el.textContent = text;
  el.className = 'message ' + type;
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 3000);
};

// Load localized messages and saved keys
document.addEventListener('DOMContentLoaded', async () => {
  const tavilyInput = document.getElementById('tavilyKey');
  const geminiInput = document.getElementById('geminiKey');
  const analyzeBtn = document.getElementById('analyzeBtn');

  // Wczytanie zapisanych kluczy z pamięci sync
  chrome.storage.sync.get(['tavilyApiKey', 'geminiApiKey'], function(result) {
    if (result.tavilyApiKey && tavilyInput) tavilyInput.value = result.tavilyApiKey;
    if (result.geminiApiKey && geminiInput) geminiInput.value = result.geminiApiKey;

    // Włącz przycisk analyze jeśli jest klucz Gemini
    if (result.geminiApiKey && analyzeBtn) {
      analyzeBtn.disabled = false;
    }
  });

  // Obsługa zapisu
  document.getElementById('saveBtn').addEventListener('click', function() {
    var tavilyValue = tavilyInput ? tavilyInput.value.trim() : '';
    var geminiValue = geminiInput ? geminiInput.value.trim() : '';

    var toSave = {};
    if (tavilyValue) toSave.tavilyApiKey = tavilyValue;
    if (geminiValue) toSave.geminiApiKey = geminiValue;

    chrome.storage.sync.set(toSave, function() {
      if (chrome.runtime.lastError) {
        window.showMessage('Błąd zapisu: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      window.showMessage('Ustawienia zapisane!', 'success');
      if (geminiValue && analyzeBtn) analyzeBtn.disabled = false;
      setTimeout(function() { window.close(); }, 1500);
    });
  });

  // Analyze Webpage
  analyzeBtn.addEventListener('click', async () => {
    try {
      const keys = await chrome.storage.sync.get(['geminiApiKey']);
      if (!keys.geminiApiKey) {
        showMessage('Najpierw zapisz klucze API', 'error');
        return;
      }

      showMessage('Analizuję stronę...', 'info');
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = '⏳ Analizuję...';

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        throw new Error('Nie można znaleźć aktywnej karty');
      }

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('about:') || tab.url.startsWith('edge://')) {
        throw new Error('Nie można analizować stron systemowych. Przejdź na normalną stronę.');
      }

      // Wstrzyknij content script (na wypadek gdyby nie był załadowany)
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (injectError) {
        // Może już być załadowany — ignorujemy błąd
      }

      // Wyciągnij tekst strony
      let extractResponse;
      try {
        extractResponse = await Promise.race([
          chrome.tabs.sendMessage(tab.id, { action: 'extractPageText' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
        ]);
      } catch (error) {
        throw new Error('Content script nie odpowiada. Odśwież stronę (F5) i spróbuj ponownie.');
      }

      if (!extractResponse || !extractResponse.success) {
        throw new Error(extractResponse?.error || 'Nie udało się wyciągnąć tekstu ze strony');
      }

      // Wyślij do background dla analizy Gemini
      const analysisResult = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout analizy po 60s')), 60000);
        chrome.runtime.sendMessage(
          { action: 'analyzePageWithGemini', text: extractResponse.text, url: tab.url },
          (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if (!analysisResult) {
        throw new Error('Brak odpowiedzi z analizy AI');
      }

      if (analysisResult.success && analysisResult.suspiciousClaims && analysisResult.suspiciousClaims.length > 0) {
        // Zaznacz podejrzane fragmenty na stronie
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'highlightClaims',
            claims: analysisResult.suspiciousClaims
          });
        } catch (highlightError) {
          // highlight failed silently
        }
        showMessage(`Przeanalizowano`, 'success');
      } else if (analysisResult.success) {
        showMessage('Przeanalizowano', 'success');
      } else {
        throw new Error(analysisResult.error || 'Analiza nie powiodła się');
      }

    } catch (error) {
      showMessage('Błąd: ' + error.message, 'error');
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = '🔎 Analyze Webpage';
    }
  });

});
