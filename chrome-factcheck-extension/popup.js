// Load localized messages and saved keys
document.addEventListener('DOMContentLoaded', async () => {
  const tavilyInput = document.getElementById('tavilyKey');
  const geminiInput = document.getElementById('geminiKey');
  const hfInput = document.getElementById('hfKey');
  const saveBtn = document.getElementById('saveBtn');
  const message = document.getElementById('message');

  // Ustawienie tekstu przycisku z plików lokalizacji (i18n)
  saveBtn.textContent = chrome.i18n.getMessage('saveButton') || 'Zapisz ustawienia';

  // Wczytanie zapisanych kluczy z pamięci sync
  const result = await chrome.storage.sync.get([
    'tavilyApiKey', 
    'geminiApiKey', 
    'hfApiKey'
  ]);

  if (result.tavilyApiKey) tavilyInput.value = result.tavilyApiKey;
  if (result.geminiApiKey) geminiInput.value = result.geminiApiKey;
  if (result.hfApiKey) hfInput.value = result.hfApiKey;

  // Obsługa zapisu
  saveBtn.addEventListener('click', async () => {
    const tavilyValue = tavilyInput.value.trim();
    const geminiValue = geminiInput.value.trim();
    const hfValue = hfInput.value.trim();
    
    // Walidacja: Tavily i Gemini są wymagane do działania
    if (!tavilyValue || !geminiValue) {
      showMessage(chrome.i18n.getMessage('error') || 'Klucze Tavily i Gemini są wymagane!', 'error');
      return;
    }

    try {
      // Zapisujemy wszystkie klucze naraz
      await chrome.storage.sync.set({ 
        tavilyApiKey: tavilyValue,
        geminiApiKey: geminiValue,
        hfApiKey: hfValue
      });

      showMessage(chrome.i18n.getMessage('apiKeySaved') || 'Ustawienia zapisane!', 'success');
      
      // Zamknij popup po krótkiej chwili
      setTimeout(() => {
        window.close();
      }, 1500);
    } catch (error) {
      showMessage('Błąd zapisu: ' + error.message, 'error');
    }
  });

  // Funkcja do wyświetlania komunikatów
  function showMessage(text, type) {
    message.textContent = text;
    message.className = 'message ' + type;
    message.style.display = 'block';
    
    setTimeout(() => {
      message.style.display = 'none';
    }, 3000);
  }
});