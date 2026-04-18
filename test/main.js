async function checkFactGemini(thesis, apiKey = "") {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{
        text: `Jesteś fact-checkerem. Oceń tezę: "${thesis}". Zwróć JSON: {"verdict": "Prawda/Fałsz", "explanation": "krótko"}`
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
  return JSON.parse(textResponse);
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