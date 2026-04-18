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
    console.log("Rozpoczynam analizę dla linków:", urls);

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
    console.log("Otrzymano cząstkowe wyniki:", individualResults);

    // 3. Ostatnie zapytanie - Werdykt końcowy
    return await generateFinalVerdict(thesis, individualResults, apiKey);
}

async function generateFinalVerdict(thesis, individualResults, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    const todaysDate = new Date().toISOString().split('T')[0];
    console.log(`Generowanie werdyktu końcowego dla tezy: "${thesis}" na podstawie analiz z dnia ${todaysDate}`);

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
        console.error("Błąd werdyktu końcowego:", error);
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
      console.log(`[Attempt ${attempt + 1}/${retries + 1}] Sprawdzanie tezy: ${thesis}`);
      console.log(site)

      const todaysDate = new Date().toISOString().split('T')[0];

      
      const prompt = `
        Jesteś profesjonalnym systemem fact-checkingowym. Twoim zadaniem jest analiza poniższej tezy.
        Skorzystaj z przekazanej strony i na jej treści przeprowadź analizę szukając odpowiedzi na tezę.
        Odpowiedzi muszą być oparte na faktach i dowodach, a nie na opiniach. Pamiętaj że dzisiaj jest dzień ${todaysDate}.
        
        Teza: "${thesis}"
        
        Zwróć odpowiedź WYŁĄCZNIE w formacie JSON o następującej strukturze:
        {
          "link": "${link}"
          "verdict": "Prawda" | "Fałsz" | "Manipulacja" | "Nieweryfikowalne",
          "explaination": "krótkie uzasadnienie"
        }

        Unikaj ogólników i niepotwierdzonych informacji. Skup się na faktach i dowodach.
      `;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

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
      console.log(`✓ Sukces na próbie ${attempt + 1}`);
      return result;
      
    } catch (error) {
      lastError = error;
      console.error(`✗ Błąd na próbie ${attempt + 1}:`, error.message);
      
      // Jeśli to ostatnia próba, rzuć błąd
      if (attempt === retries) {
        console.error(`Wszystkie ${retries + 1} próby nie powiodły się.`);
        throw new Error(`Nie udało się po ${retries + 1} próbach: ${lastError.message}`);
      }
      
      // Czekaj przed kolejną próbą (exponential backoff)
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`Czekanie ${waitTime}ms przed następną próbą...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Dane które dostajesz z Twojej mapy
const myData = {
    results: [
        { title: "News 1", url: "https://en.wikipedia.org/wiki/President_of_Russia", content: "...", score: 0.9 },
        { title: "News 2", url: "https://www.pism.pl/webroot/upload/files/Ksi%C4%85%C5%BCki/Yearbook%20of%20%20Polish%20Foreign%20Policy%202019%20maly.pdf", content: "...", score: 0.8 }
    ]
};

const userThesis = "Andrzej Duda jest prezydentem Rosji";

(async () => {
    try {
        console.log("Startujemy z koksem...");
        const finalResult = await runFullFactCheck(myData.results, userThesis, "");
        
        console.log("=== OSTATECZNY WYNIK ===");
        console.log(finalResult);
        // finalResult będzie miał strukturę: { analysisText, verdict, sourceSummaries }
    } catch (err) {
        console.error("Coś padło całkowicie:", err);
    }
})();