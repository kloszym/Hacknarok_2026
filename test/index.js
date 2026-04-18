const { GoogleGenerativeAI } = require("@google/generative-ai");

// Konfiguracja
const API_KEY = ""; // Wklej swój klucz z Google AI Studio
const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({
  model: "models/gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
  },
});

/**
 * System Fact-Checkingu
 * @param {string} thesis - Teza do sprawdzenia
 * @param {number} retries - Liczba pozostałych prób
 */
async function checkFact(thesis, retries = 2) {
  const isoData = new Date().toISOString().split('T')[0];
  console.log(isoData); // Wynik: "2024-05-22"  
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

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    return JSON.parse(responseText);
  } catch (error) {
    if (retries > 0) {
      console.warn(`Błąd połączenia. Ponawiam próbę... (Pozostało: ${retries})`);
      return await checkFact(thesis, retries - 1);
    } else {
      throw new Error(`Nie udało się przetworzyć tezy po wielu próbach. Ostatni błąd: ${error.message}`);
    }
  }
}

// --- Przykład użycia ---
(async () => {
  // const mojaTeza = "Picie zimnej wody natychmiast po posiłku powoduje twardnienie tłuszczów i raka żołądka.";
  // const mojaTeza = "Szczepionki przeciw COVID-19 powodują autyzm u dzieci.";
  const mojaTeza = "Lądowanie na Księżycu w 1969 roku było sfabrykowane przez NASA.";
  // const mojaTeza = "Andrzej Duda jest prezydentem Polski";
  // const mojaTeza = "JFK został zamordowany przez CIA.";

  
  try {
    console.log("Analizuję...");
    const result = await checkFact(mojaTeza);
    
    console.log("--- WYNIK ANALIZY ---");
    console.log(JSON.stringify(result, null, 2));
    
  } catch (err) {
    console.error("BŁĄD KRYTYCZNY:", err.message);
  }
})();