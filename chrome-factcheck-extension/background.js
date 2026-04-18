// background.js - Service Worker dla rozszerzenia
console.log('[BACKGROUND] Service worker uruchomiony');

// Utwórz menu kontekstowe po zainstalowaniu
chrome.runtime.onInstalled.addListener(() => {
  console.log('[BACKGROUND] Rozszerzenie zainstalowane, tworzę menu kontekstowe...');
  chrome.contextMenus.create({
    id: 'factcheck',
    title: 'Sprawdź prawdziwość',
    contexts: ['selection']
  });
  console.log('[BACKGROUND] Menu kontekstowe utworzone');
});

// Obsługa kliknięcia w menu kontekstowe
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('[BACKGROUND] Kliknięto menu kontekstowe');
  console.log('[BACKGROUND] Zaznaczony tekst:', info.selectionText);
  
  if (info.menuItemId === 'factcheck' && info.selectionText) {
    try {
      // Pobierz klucze API
      console.log('[BACKGROUND] Pobieram klucze API...');
      const keys = await chrome.storage.sync.get(['tavilyApiKey', 'geminiApiKey']);
      
      if (!keys.tavilyApiKey || !keys.geminiApiKey) {
        console.log('[BACKGROUND] Błąd: Brak kluczy API');
        throw new Error('Najpierw skonfiguruj klucze API w popup rozszerzenia');
      }
      
      console.log('[BACKGROUND] Klucze API pobrane pomyślnie');
      
      // Importuj workflow i uruchom fact-checking
      console.log('[BACKGROUND] Importuję workflow...');
      const { runFactCheckWorkflow } = await import('./workflow.js');
      
      console.log('[BACKGROUND] Uruchamiam workflow fact-checking...');
      const result = await runFactCheckWorkflow(
        info.selectionText,
        keys.tavilyApiKey,
        keys.geminiApiKey
      );
      
      console.log('[BACKGROUND] Workflow zakończony, wynik:', result);
      
      // Otwórz popup z wynikami
      console.log('[BACKGROUND] Otwieranie popup z wynikami...');
      const popupUrl = chrome.runtime.getURL('factcheck.html');
      const width = 400;
      const height = 600;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;
      
      const popup = await chrome.windows.create({
        url: popupUrl,
        type: 'popup',
        width: width,
        height: height,
        left: Math.round(left),
        top: Math.round(top)
      });
      
      console.log('[BACKGROUND] Popup utworzony, ID:', popup.id);
      
      // Zapisz wyniki do storage dla popup
      await chrome.storage.local.set({ lastFactCheckResult: result });
      console.log('[BACKGROUND] Wyniki zapisane do storage');
      
    } catch (error) {
      console.error('[BACKGROUND] Błąd fact-checking:', error);
      // Możesz dodać powiadomienie dla użytkownika
    }
  }
});

// Nasłuchuj wiadomości z popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[BACKGROUND] Otrzymano wiadomość:', request.action);
  
  if (request.action === 'analyzePageWithGemini') {
    console.log('[BACKGROUND] Akcja: analyzePageWithGemini');
    console.log('[BACKGROUND] Długość tekstu do analizy:', request.text?.length);
    console.log('[BACKGROUND] URL strony:', request.url);
    
    // Uruchom analizę asynchronicznie
    analyzePageWithGemini(request.text, request.url)
      .then(result => {
        console.log('[BACKGROUND] Analiza Gemini zakończona:', {
          success: result.success,
          claimsCount: result.suspiciousClaims?.length,
          error: result.error
        });
        sendResponse(result);
      })
      .catch(error => {
        console.error('[BACKGROUND] Błąd analizy Gemini:', error);
        sendResponse({ 
          success: false, 
          error: error.message 
        });
      });
    
    return true; // Asynchroniczna odpowiedź
  }
  
  return false;
});

// Funkcja analizy strony z Gemini
async function analyzePageWithGemini(pageText, pageUrl) {
  console.log('[BACKGROUND] analyzePageWithGemini: START');
  console.log('[BACKGROUND] Długość tekstu:', pageText.length);
  console.log('[BACKGROUND] URL:', pageUrl);
  
  try {
    // Pobierz klucz Gemini
    console.log('[BACKGROUND] Pobieram klucz Gemini...');
    const keys = await chrome.storage.sync.get(['geminiApiKey']);
    const apiKey = keys.geminiApiKey;
    
    if (!apiKey) {
      console.log('[BACKGROUND] Błąd: Brak klucza Gemini');
      throw new Error('Brak klucza API Gemini');
    }
    
    console.log('[BACKGROUND] Klucz Gemini pobrany');
    
    // Przygotuj prompt dla Gemini
    const prompt = `Jesteś ekspertem od wykrywania dezinformacji i manipulacji w treściach internetowych.

Przeanalizuj poniższą treść ze strony: ${pageUrl}

TREŚĆ STRONY:
${pageText.substring(0, 30000)}

ZADANIE:
Znajdź maksymalnie 10 najbardziej podejrzanych stwierdzeń (manipulacja, dezinformacja, fake news).

FORMAT ODPOWIEDZI (TYLKO JSON, BEZ TEKSTU):
["cytat1","cytat2","cytat3"]

PRZYKŁAD:
["Szczepionki zawierają chipy 5G","Ziemia jest płaska"]

ZASADY:
- TYLKO tablica stringów JSON, zero dodatkowego tekstu
- Jeśli brak podejrzanych: []
- Max 10 twierdzeń
- Każdy cytat: max 200 znaków, dokładny cytat ze strony
`;

    console.log('[BACKGROUND] Wysyłam zapytanie do Gemini API...');
    
    // Wywołaj Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          topP: 0.8,
          topK: 40
        }
      })
    });
    
    console.log('[BACKGROUND] Status odpowiedzi Gemini:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[BACKGROUND] Błąd API Gemini:', errorData);
      throw new Error(errorData.error?.message || 'Błąd zapytania do Gemini API');
    }
    
    const data = await response.json();
    console.log('[BACKGROUND] Otrzymano dane z Gemini');
    
    // Wyciągnij tekst odpowiedzi
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[BACKGROUND] Tekst odpowiedzi Gemini (długość):', responseText.length);
    console.log('[BACKGROUND] Pierwsze 500 znaków:', responseText.substring(0, 500));
    
    // Parsuj JSON z odpowiedzi - usuń markdown i inne śmieci
    let suspiciousClaims = [];
    try {
      // Usuń markdown code blocks jeśli są
      let cleanText = responseText.trim();
      // Usuń początkowy ```json
      cleanText = cleanText.replace(/^```json\s*/i, '');
      // Usuń końcowy ```
      cleanText = cleanText.replace(/```\s*$/i, '');
      cleanText = cleanText.trim();
      
      console.log('[BACKGROUND] Oczyszczony tekst (pierwsze 200 znaków):', cleanText.substring(0, 200));
      
      // Znajdź tablicę JSON
      const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        console.log('[BACKGROUND] Znaleziono tablicę JSON');
        suspiciousClaims = JSON.parse(jsonMatch[0]);
        console.log('[BACKGROUND] JSON sparsowany pomyślnie, liczba twierdzeń:', suspiciousClaims.length);
      } else {
        console.log('[BACKGROUND] Nie znaleziono tablicy JSON, próbuję parsować cały tekst...');
        // Spróbuj sparsować cały tekst
        suspiciousClaims = JSON.parse(cleanText);
        console.log('[BACKGROUND] Cały tekst sparsowany jako JSON, liczba twierdzeń:', suspiciousClaims.length);
      }
    } catch (parseError) {
      console.error('[BACKGROUND] Błąd parsowania JSON:', parseError);
      console.log('[BACKGROUND] Surowa odpowiedź:', responseText);
      // Zwróć pustą tablicę zamiast błędu
      suspiciousClaims = [];
    }
    
    // Waliduj i oczyść twierdzenia
    if (Array.isArray(suspiciousClaims)) {
      // Nowy format: tablica stringów ["cytat1", "cytat2"]
      suspiciousClaims = suspiciousClaims
        .filter(claim => claim && typeof claim === 'string' && claim.trim())
        .map(claim => ({
          text: String(claim).substring(0, 200),
          reason: 'Potencjalna dezinformacja wykryta przez AI'
        }))
        .slice(0, 10); // Max 10 twierdzeń
      
      console.log('[BACKGROUND] Przefiltrowano twierdzenia, finalna liczba:', suspiciousClaims.length);
    } else {
      console.log('[BACKGROUND] Odpowiedź nie jest tablicą, ustawiam pustą tablicę');
      suspiciousClaims = [];
    }
    
    console.log('[BACKGROUND] Finalne podejrzane twierdzenia:', suspiciousClaims);
    
    return {
      success: true,
      suspiciousClaims: suspiciousClaims
    };
    
  } catch (error) {
    console.error('[BACKGROUND] Błąd w analyzePageWithGemini:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

console.log('[BACKGROUND] Service worker gotowy do pracy');