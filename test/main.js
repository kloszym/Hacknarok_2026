async function checkFactGemini(thesis, apiKey = "", retries = 2) {
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const isoData = new Date().toISOString().split('T')[0];
      console.log(`[Attempt ${attempt + 1}/${retries + 1}] Sprawdzanie tezy: ${thesis}`);
      console.log(isoData);
      
      const prompt = `
        Jesteś profesjonalnym systemem fact-checkingowym. Twoim zadaniem jest analiza poniższej tezy.
        Skorzystaj ze swojej wiedzy i przeprowadź symulację wyszukiwania informacji.
        Odpowiedzi muszą być oparte na faktach i dowodach, a nie na opiniach. Uwzględnij aktualne dane do dnia ${isoData}.
        
        Teza: "${thesis}"
        
        Zwróć odpowiedź WYŁĄCZNIE w formacie JSON o następującej strukturze:
        {
          "verdict": "Prawda" | "Fałsz" | "Manipulacja" | "Nieweryfikowalne",
          "confidence_score": 0-100,
          "explanation": "Krótkie uzasadnienie (max 3 zdania)",
          "sources": {
            "title": "Tytuł źródła",
            "url": "Link do źródła",
            "publisher": "Wydawca",
            "date": "Data publikacji"
            "quote": "Cytat z artykułu potwierdzający lub obalający tezę"
          }[],
          "counter_arguments": "Ewentualne argumenty przeciw"
        }

        Upewnij się że linki i argumenty które używasz są aktualne i wiarygodne. Unikaj ogólników i niepotwierdzonych informacji. Skup się na faktach i dowodach.
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

(async () => {
    try {
        const thesis = "Ziemia jest płaska.";
        const result = await checkFactGemini(thesis);
        console.log(result);
    } catch (error) {
        console.error("Błąd podczas sprawdzania tezy:", error);
    }
})();