// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[POPUP] Inicjalizacja popup.js');
  
  const tavilyInput = document.getElementById('tavilyKey');
  const geminiInput = document.getElementById('geminiKey');
  const saveBtn = document.getElementById('saveBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const message = document.getElementById('message');

  // Wczytaj zapisane klucze
  console.log('[POPUP] Wczytuję zapisane klucze...');
  const keys = await chrome.storage.sync.get(['tavilyApiKey', 'geminiApiKey']);
  console.log('[POPUP] Klucze wczytane:', { 
    hasTavily: !!keys.tavilyApiKey, 
    hasGemini: !!keys.geminiApiKey 
  });
  
  if (keys.tavilyApiKey) tavilyInput.value = keys.tavilyApiKey;
  if (keys.geminiApiKey) geminiInput.value = keys.geminiApiKey;

  // Włącz/wyłącz przycisk Analyze w zależności od kluczy
  if (keys.geminiApiKey) {
    analyzeBtn.disabled = false;
    console.log('[POPUP] Przycisk Analyze włączony');
  } else {
    analyzeBtn.disabled = true;
    console.log('[POPUP] Przycisk Analyze wyłączony - brak klucza Gemini');
  }

  // Zapisz klucze
  saveBtn.addEventListener('click', async () => {
    console.log('[POPUP] Kliknięto przycisk Zapisz');
    const tavily = tavilyInput.value.trim();
    const gemini = geminiInput.value.trim();

    if (!tavily || !gemini) {
      console.log('[POPUP] Błąd: Puste pola');
      showMessage('Proszę wypełnić oba pola API', 'error');
      return;
    }

    try {
      console.log('[POPUP] Zapisuję klucze...');
      await chrome.storage.sync.set({
        tavilyApiKey: tavily,
        geminiApiKey: gemini
      });
      console.log('[POPUP] Klucze zapisane pomyślnie');
      showMessage('Klucze zapisane pomyślnie!', 'success');
      analyzeBtn.disabled = false;
      
      setTimeout(() => {
        message.style.display = 'none';
      }, 2000);
    } catch (error) {
      console.error('[POPUP] Błąd zapisywania kluczy:', error);
      showMessage('Błąd: ' + error.message, 'error');
    }
  });

  // Analyze Webpage
  analyzeBtn.addEventListener('click', async () => {
    console.log('[POPUP] ========== ROZPOCZĘCIE ANALIZY ==========');
    
    try {
      // Sprawdź czy klucze są zapisane
      console.log('[POPUP] Sprawdzam klucze API...');
      const result = await chrome.storage.sync.get(['geminiApiKey']);
      if (!result.geminiApiKey) {
        console.log('[POPUP] Błąd: Brak klucza Gemini');
        showMessage('Najpierw zapisz klucze API', 'error');
        return;
      }
      console.log('[POPUP] Klucz Gemini OK');

      showMessage('Analizuję stronę...', 'info');
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = '⏳ Analizuję...';

      // Pobierz aktywną kartę
      console.log('[POPUP] Pobieram aktywną kartę...');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('[POPUP] Aktywna karta:', { id: tab?.id, url: tab?.url });
      
      if (!tab || !tab.id) {
        throw new Error('Nie można znaleźć aktywnej karty');
      }

      // Sprawdź czy URL jest dozwolony
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
          tab.url.startsWith('about:') || tab.url.startsWith('edge://')) {
        throw new Error('Nie można analizować stron systemowych Chrome. Przejdź na normalną stronę internetową.');
      }

      // ZAWSZE wstrzyknij content script (może nie być załadowany z manifest.json)
      console.log('[POPUP] Wstrzykuję content script...');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('[POPUP] Content script wstrzyknięty');
        // Poczekaj na inicjalizację
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (injectError) {
        console.log('[POPUP] Nie można wstrzyknąć (może już być załadowany):', injectError.message);
      }

      // Wyślij wiadomość do content script aby wyciągnął tekst
      console.log('[POPUP] Wysyłam wiadomość extractPageText do content script...');
      
      let response;
      try {
        response = await Promise.race([
          chrome.tabs.sendMessage(tab.id, { action: 'extractPageText' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout po 15s')), 15000))
        ]);
        console.log('[POPUP] Odpowiedź od content script:', {
          success: response?.success,
          textLength: response?.text?.length,
          error: response?.error
        });
      } catch (error) {
        console.error('[POPUP] Błąd komunikacji z content script:', error);
        throw new Error('Content script nie odpowiada. ODŚWIEŻ STRONĘ (F5) i spróbuj ponownie.');
      }

      if (!response || !response.success) {
        throw new Error(response?.error || 'Nie udało się wyciągnąć tekstu ze strony');
      }

      console.log('[POPUP] Tekst wyciągnięty, długość:', response.text.length);

      // Wyślij do background dla analizy Gemini
      console.log('[POPUP] Wysyłam do background script dla analizy Gemini...');
      let analysisResult;
      try {
        analysisResult = await new Promise((resolve, reject) => {
          console.log('[POPUP] Wywołuję chrome.runtime.sendMessage...');
          const timeout = setTimeout(() => {
            reject(new Error('Timeout analizy Gemini po 60s'));
          }, 60000);
          
          chrome.runtime.sendMessage({
            action: 'analyzePageWithGemini',
            text: response.text,
            url: tab.url
          }, (response) => {
            clearTimeout(timeout);
            console.log('[POPUP] Odpowiedź od background script:', response);
            if (chrome.runtime.lastError) {
              console.error('[POPUP] chrome.runtime.lastError:', chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
      } catch (error) {
        console.error('[POPUP] Błąd komunikacji z background script:', error);
        throw new Error('Błąd analizy AI: ' + error.message);
      }

      if (!analysisResult) {
        throw new Error('Brak odpowiedzi z analizy AI');
      }

      console.log('[POPUP] ===== PUNKT KONTROLNY 1 =====');
      console.log('[POPUP] Wynik analizy:', {
        success: analysisResult.success,
        claimsCount: analysisResult.suspiciousClaims?.length,
        error: analysisResult.error
      });

      console.log('[POPUP] ===== PUNKT KONTROLNY 2 =====');
      console.log('[POPUP] Sprawdzam warunek:', {
        success: analysisResult.success,
        hasClaims: !!analysisResult.suspiciousClaims,
        claimsLength: analysisResult.suspiciousClaims?.length,
        condition: analysisResult.success && analysisResult.suspiciousClaims && analysisResult.suspiciousClaims.length > 0
      });

      if (analysisResult.success && analysisResult.suspiciousClaims && analysisResult.suspiciousClaims.length > 0) {
        console.log('[POPUP] ===== WCHODZĘ DO BLOKU ZAZNACZANIA =====');
        
        // Zaznacz podejrzane fragmenty na stronie
        console.log('[POPUP] ===== WYSYŁAM WIADOMOŚĆ highlightClaims =====');
        console.log('[POPUP] Tab ID:', tab.id);
        console.log('[POPUP] Liczba twierdzeń:', analysisResult.suspiciousClaims.length);
        console.log('[POPUP] Twierdzenia:', JSON.stringify(analysisResult.suspiciousClaims, null, 2));
        
        try {
          console.log('[POPUP] Wywołuję chrome.tabs.sendMessage z highlightClaims...');
          const highlightResponse = await chrome.tabs.sendMessage(tab.id, {
            action: 'highlightClaims',
            claims: analysisResult.suspiciousClaims
          });
          console.log('[POPUP] Odpowiedź od highlightClaims:', highlightResponse);
          console.log('[POPUP] Zaznaczenia dodane pomyślnie');
        } catch (error) {
          console.error('[POPUP] BŁĄD zaznaczania:', error);
          console.error('[POPUP] Stack:', error.stack);
          // Kontynuuj mimo błędu zaznaczania
        }
        
        showMessage(`Znaleziono ${analysisResult.suspiciousClaims.length} podejrzanych twierdzeń`, 'success');
      } else if (analysisResult.success) {
        console.log('[POPUP] Nie znaleziono podejrzanych twierdzeń');
        showMessage('Nie znaleziono podejrzanych twierdzeń', 'success');
      } else {
        throw new Error(analysisResult.error || 'Analiza nie powiodła się');
      }

      analyzeBtn.disabled = false;
      analyzeBtn.textContent = '🔎 Analyze Webpage';
      
      console.log('[POPUP] ========== ANALIZA ZAKOŃCZONA SUKCESEM ==========');
      
      // NIE ZAMYKAJ POPUP - zostaw otwarte dla debugowania
      // setTimeout(() => {
      //   window.close();
      // }, 2000);
    } catch (error) {
      console.error('[POPUP] ========== BŁĄD ANALIZY ==========');
      console.error('[POPUP] Szczegóły błędu:', error);
      console.error('[POPUP] Stack trace:', error.stack);
      showMessage('Błąd: ' + error.message, 'error');
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = '🔎 Analyze Webpage';
    }
  });

  function showMessage(text, type) {
    console.log('[POPUP] Wyświetlam wiadomość:', { text, type });
    message.textContent = text;
    message.className = 'message ' + type;
    message.style.display = 'block';
  }
});