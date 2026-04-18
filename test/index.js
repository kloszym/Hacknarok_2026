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
  const prompt = `
    Jesteś profesjonalnym systemem fact-checkingowym. Twoim zadaniem jest analiza poniższej tezy.
    Skorzystaj ze swojej wiedzy i przeprowadź symulację wyszukiwania informacji.
    
    Teza: "${thesis}"
    
    Zwróć odpowiedź WYŁĄCZNIE w formacie JSON o następującej strukturze:
    {
      "verdict": "Prawda" | "Fałsz" | "Manipulacja" | "Nieweryfikowalne",
      "confidence_score": 0-100,
      "explanation": "Krótkie uzasadnienie (max 3 zdania)",
      "sources": ["lista typów źródeł lub konkretnych faktów"],
      "counter_arguments": "Ewentualne argumenty przeciw"
    }
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
  const mojaTeza = "Picie zimnej wody natychmiast po posiłku powoduje twardnienie tłuszczów i raka żołądka.";
  
  try {
    console.log("Analizuję...");
    const result = await checkFact(mojaTeza);
    
    console.log("--- WYNIK ANALIZY ---");
    console.log(JSON.stringify(result, null, 2));
    
  } catch (err) {
    console.error("BŁĄD KRYTYCZNY:", err.message);
  }
})();