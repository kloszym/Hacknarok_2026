const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI("");

async function listModels() {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${genAI.apiKey}`);
  const data = await response.json();
  console.log("Dostępne modele:");
  data.models.forEach(m => console.log(m.name));
}
listModels();