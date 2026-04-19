
let selectedText = '';

async function initializeFactCheck() {
  const storage = await chrome.storage.local.get(['selectedText', 'timestamp']);
  
  if (storage.selectedText && storage.timestamp) {
    const age = Date.now() - storage.timestamp;
    if (age < 10000) { // ważne przez 10 sekund
      selectedText = storage.selectedText;
    }
  }
  
  document.getElementById('selectedText').textContent = selectedText || 'Brak zaznaczonego tekstu';
  
  if (selectedText) {
    startVerification();
  } else {
    displayError('Nie zaznaczono żadnego tekstu do weryfikacji.');
  }
}

async function startVerification() {
  const loadingText = document.getElementById('loadingText');
  const loadingSection = document.getElementById('loadingSection');
  const resultsSection = document.getElementById('resultsSection');
  const errorSection = document.getElementById('errorSection');

  loadingSection.style.display = 'block';
  resultsSection.style.display = 'none';
  errorSection.style.display = 'none';

  loadingText.textContent = "Uruchamianie wyszukiwarki Tavily...";

  try {
    setTimeout(() => {
      if (loadingSection.style.display !== 'none') {
        loadingText.textContent = "Gemini analizuje znalezione artykuły...";
      }
    }, 2000);

    const response = await chrome.runtime.sendMessage({
      action: 'factcheck',
      text: selectedText
    });
    
    if (response.success) {
      displayResults(response);
    } else {
      displayError(response.error || 'Wystąpił nieoczekiwany błąd podczas weryfikacji.');
    }
  } catch (error) {
    displayError("Błąd komunikacji: " + error.message);
  }
}

function displayResults(data) {
  document.getElementById('loadingSection').style.display = 'none';
  document.getElementById('resultsSection').style.display = 'block';
  
  document.getElementById('analysisText').textContent = data.analysis;
  
  const verdictContainer = document.getElementById('verdictContainer');
  verdictContainer.innerHTML = ''; 
  
  const verdict = data.verdict || 'unknown';
  const verdictEl = document.createElement('div');
  verdictEl.className = `verdict ${verdict}`;
  
  const verdictLabels = {
    'true': '✓ PRAWDA',
    'false': '✗ FAŁSZ',
    'partial': '◐ CZĘŚCIOWO',
    'context': '⚠ WYMAGA KONTEKSTU',
    'unknown': '? NIEZNANE'
  };
  
  verdictEl.textContent = verdictLabels[verdict] || verdictLabels['unknown'];
  verdictContainer.appendChild(verdictEl);
  
  const sourcesList = document.getElementById('sourcesList');
  sourcesList.innerHTML = '';
  
  if (data.sources && data.sources.length > 0) {
    data.sources.forEach(source => {
      const li = document.createElement('li');
      li.className = 'source-item';
      
      const typeSpan = document.createElement('span');
      typeSpan.className = 'source-type';
      typeSpan.textContent = source.type;
      li.appendChild(typeSpan);
      
      const pub = document.createElement('strong');
      pub.style.marginLeft = '5px';
      pub.textContent = source.publisher;
      li.appendChild(pub);

      const score = document.createElement('small');
      score.style.color = '#888';
      score.style.marginLeft = '8px';
      score.textContent = `(${source.rating})`;
      li.appendChild(score);
      
      li.appendChild(document.createElement('br'));
      
      // Link do źródła
      const link = document.createElement('a');
      link.href = source.value;
      link.target = '_blank';
      link.textContent = source.value;
      li.appendChild(link);

      // --- NOWOŚĆ: Notatka od Gemini o tym konkretnym źródle ---
      if (source.note) {
        const noteDiv = document.createElement('div');
        noteDiv.style.marginTop = '8px';
        noteDiv.style.padding = '8px';
        noteDiv.style.backgroundColor = '#f4f4f9';
        noteDiv.style.borderLeft = '3px solid #667eea';
        noteDiv.style.borderRadius = '4px';
        noteDiv.style.fontSize = '10px';
        noteDiv.style.color = '#444';
        noteDiv.style.lineHeight = '1.4';
        noteDiv.style.fontStyle = 'italic';
        
        // Nagłówek notatki AI
        const noteHeader = document.createElement('div');
        noteHeader.style.fontWeight = 'bold';
        noteHeader.style.marginBottom = '3px';
        noteHeader.style.color = '#764ba2';
        noteHeader.textContent = '✨ Wnioski AI z tego źródła:';
        
        noteDiv.appendChild(noteHeader);
        noteDiv.appendChild(document.createTextNode(source.note));
        li.appendChild(noteDiv);
      }
      
      sourcesList.appendChild(li);
    });
  } else {
    sourcesList.innerHTML = '<div class="no-sources">Nie znaleziono bezpośrednich źródeł fact-checkingu.</div>';
  }
  
  document.getElementById('modelName').textContent = data.api || 'Tavily + Gemini Pipeline';
}

function displayError(errorMessage) {
  document.getElementById('loadingSection').style.display = 'none';
  document.getElementById('errorSection').style.display = 'block';
  document.getElementById('errorText').textContent = "Błąd: " + errorMessage;
}

document.addEventListener('DOMContentLoaded', initializeFactCheck);