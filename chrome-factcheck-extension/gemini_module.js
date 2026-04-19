// gemini_module.js

async function analyzeLink(urlFromUser) {
    try {
        const response = await fetch(urlFromUser);
        if (!response.ok) throw new Error("Strona nie odpowiedziała");
        const html = await response.text();
        
        // Poprawiony regex, który łapie <p> z atrybutami (np. <p class="text">)
        const matches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/g);
        if (!matches) return "Brak treści tekstowej na stronie.";

        const cleanText = matches
            .map(val => val.replace(/<[^>]*>/g, '').trim())
            .filter(text => text.length > 20)
            .join('\n\n');

        return cleanText.substring(0, 8000); // 8k znaków starczy na analizę
    } catch (e) {
        return "Błąd pobierania treści: " + e.message;
    }
}

async function runFullFactCheck(searchResults, thesis, apiKey) {

    // 1. Wyjmij same URLe (ogranicz do 5, żeby nie zabić limitów)
    const urls = searchResults.map(r => r.url).slice(0, 5);

    // 2. Odpal checkFactGemini dla każdego linku ASYNCHRONICZNIE
    // Promise.allSettled jest bezpieczniejsze - jeśli jeden padnie, reszta idzie dalej
    const individualResultsPromises = urls.map(link => 
        checkFactGemini(link, thesis, apiKey).catch(err => ({
            link: link,
            verdict: "Błąd",
            explaination: "Nie udało się przeanalizować tej strony: " + err.message
        }))
    );

    const individualResults = await Promise.all(individualResultsPromises);

    // 3. Ostatnie zapytanie - Werdykt końcowy
    return await generateFinalVerdict(thesis, individualResults, apiKey);
}

async function generateFinalVerdict(thesis, individualResults, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const todaysDate = new Date().toISOString().split('T')[0];

    const prompt = `
        Jesteś głównym sędzią systemu fact-checkingowego. 
        Twój cel: Na podstawie kilku analiz różnych źródeł wydaj jeden ostateczny werdykt dla tezy.
        Pamiętaj, że Twoje odpowiedzi muszą być oparte na faktach i dowodach, a nie na opiniach. Uwzględnij aktualne dane do dnia ${todaysDate}.

        Teza: "${thesis}"
        Analizy źródeł: ${JSON.stringify(individualResults)}

        Zwróć odpowiedź WYŁĄCZNIE w formacie JSON o strukturze:
        {
          "analysisText": "Ogólna analiza całego twierdzenia na podstawie wszystkich źródeł.",
          "verdict": "true | false | partial | context | unknown", // Prawda, Fałsz, Częściowo prawda, potrzebny kontekst, Nieznany
          "sourceSummaries": ["tu wstaw tablicę samych pól explaination z otrzymanych wyników"]
        }
    `;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await response.json();
        const textResponse = data.candidates[0].content.parts[0].text;
        return JSON.parse(textResponse);
    } catch (error) {
        return {
            analysisText: "Błąd podczas generowania werdyktu końcowego.",
            verdict: "error",
            sourceSummaries: individualResults.map(r => r.explaination)
        };
    }
}

async function checkFactGemini(link, thesis, apiKey, retries = 2) {
  let lastError;

  
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {

      const site = await analyzeLink(link);
      const todaysDate = new Date().toISOString().split('T')[0];

      
      const prompt = `
        Jesteś profesjonalnym systemem fact-checkingowym. Twoim zadaniem jest analiza poniższej tezy.
        Skorzystaj z przekazanej strony i na jej treści przeprowadź analizę szukając odpowiedzi na tezę.
        Odpowiedzi muszą być oparte na faktach i dowodach, a nie na opiniach. Pamiętaj że dzisiaj jest dzień ${todaysDate}.
        
        Teza: "${thesis}"

        Strona do analizy: ${site}
        
        Zwróć odpowiedź WYŁĄCZNIE w formacie JSON o następującej strukturze:
        {
          "link": "${link}"
          "verdict": "Prawda" | "Fałsz" | "Manipulacja" | "Nieweryfikowalne",
          "explaination": "krótkie uzasadnienie"
        }

        Unikaj ogólników i niepotwierdzonych informacji. Skup się na faktach i dowodach.
      `;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${response.status} - ${errorData.error.message}`);
      }

      const data = await response.json();
      // Odpowiedź od Gemini znajduje się w tej ścieżce:
      const textResponse = data.candidates[0].content.parts[0].text;
      const result = JSON.parse(textResponse);
      return result;
      
    } catch (error) {
      lastError = error;
      
      if (attempt === retries) {
        throw new Error(`Nie udało się po ${retries + 1} próbach: ${lastError.message}`);
      }
      
      const waitTime = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}


async function analyzeWithGemini(claim, searchContext) {
  const keys = await chrome.storage.sync.get(['geminiApiKey']);
  const apiKey = keys.geminiApiKey;
  try {
        const finalResult = await runFullFactCheck(searchContext, claim, apiKey);
        
        return finalResult;
        // finalResult będzie miał strukturę: { analysisText, verdict, sourceSummaries }
    } catch (err) {
        // analyzeWithGemini failed
    }

}

async function analyzePageWithGemini(pageText, pageUrl) {
  try {
    const keys = await chrome.storage.sync.get(['geminiApiKey']);
    const apiKey = keys.geminiApiKey;

    if (!apiKey) {
      throw new Error('Brak klucza API Gemini');
    }

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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          topP: 0.8,
          topK: 40
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Błąd zapytania do Gemini API');
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let suspiciousClaims = [];
    try {
      let cleanText = responseText.trim()
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
      suspiciousClaims = JSON.parse(jsonMatch ? jsonMatch[0] : cleanText);
    } catch (parseError) {
      suspiciousClaims = [];
    }

    if (Array.isArray(suspiciousClaims)) {
      suspiciousClaims = suspiciousClaims
        .filter(claim => claim && typeof claim === 'string' && claim.trim())
        .map(claim => ({
          text: String(claim).substring(0, 200),
          reason: 'Potencjalna dezinformacja wykryta przez AI'
        }))
        .slice(0, 10);
    } else {
      suspiciousClaims = [];
    }

    return { success: true, suspiciousClaims };

  } catch (error) {
    return { success: false, error: error.message };
  }
}