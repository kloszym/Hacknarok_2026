// Get the selected text from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const selectedText = urlParams.get('text');

// Display the selected text
document.getElementById('selectedText').textContent = selectedText || 'No text selected';

// Set loading text
document.getElementById('loadingText').textContent = chrome.i18n.getMessage('analyzing');

// Perform fact-check
async function performFactCheck() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'factcheck',
      text: selectedText
    });
    
    if (response.success) {
      displayResults(response);
    } else {
      displayError(response.error || 'Unknown error occurred');
    }
  } catch (error) {
    displayError(error.message);
  }
}

function displayResults(data) {
  // Hide loading, show results
  document.getElementById('loadingSection').style.display = 'none';
  document.getElementById('resultsSection').style.display = 'block';
  
  // Display analysis
  const analysisText = data.analysis || 'No analysis available';
  document.getElementById('analysisText').textContent = analysisText;
  
  // Display verdict
  const verdictContainer = document.getElementById('verdictContainer');
  const verdict = data.verdict || 'unknown';
  const verdictEl = document.createElement('div');
  verdictEl.className = `verdict ${verdict}`;
  
  switch(verdict) {
    case 'true':
      verdictEl.textContent = '✓ TRUE';
      break;
    case 'false':
      verdictEl.textContent = '✗ FALSE';
      break;
    case 'partial':
      verdictEl.textContent = '◐ PARTIALLY TRUE';
      break;
    case 'context':
      verdictEl.textContent = '⚠ NEEDS CONTEXT';
      break;
    default:
      verdictEl.textContent = '? UNKNOWN';
  }
  
  verdictContainer.appendChild(verdictEl);
  
  // Display sources
  const sourcesList = document.getElementById('sourcesList');
  if (data.sources && data.sources.length > 0) {
    data.sources.forEach(source => {
      const li = document.createElement('li');
      li.className = 'source-item';
      
      const typeSpan = document.createElement('span');
      typeSpan.className = 'source-type';
      typeSpan.textContent = source.type;
      li.appendChild(typeSpan);
      
      if (source.publisher) {
        const publisherSpan = document.createElement('span');
        publisherSpan.style.fontWeight = 'bold';
        publisherSpan.style.marginLeft = '8px';
        publisherSpan.textContent = source.publisher;
        li.appendChild(publisherSpan);
        
        if (source.rating) {
          const ratingSpan = document.createElement('span');
          ratingSpan.style.marginLeft = '8px';
          ratingSpan.style.color = '#666';
          ratingSpan.textContent = `(${source.rating})`;
          li.appendChild(ratingSpan);
        }
        
        li.appendChild(document.createElement('br'));
      }
      
      if (source.type === 'url' && source.value) {
        const link = document.createElement('a');
        link.href = source.value;
        link.target = '_blank';
        link.textContent = source.value;
        link.style.marginLeft = source.publisher ? '0' : '8px';
        li.appendChild(link);
      } else {
        const text = document.createTextNode(source.value);
        li.appendChild(text);
      }
      
      sourcesList.appendChild(li);
    });
  } else {
    sourcesList.innerHTML = '<div class="no-sources">No fact-check sources found. This claim may not have been reviewed by fact-checking organizations yet.</div>';
  }
  
  // Display API info
  document.getElementById('modelName').textContent = data.api || 'Google Fact Check Tools API';
}

function displayError(errorMessage) {
  document.getElementById('loadingSection').style.display = 'none';
  document.getElementById('errorSection').style.display = 'block';
  document.getElementById('errorText').textContent = `${chrome.i18n.getMessage('error')}: ${errorMessage}`;
}

// Start fact-checking when page loads
if (selectedText) {
  performFactCheck();
} else {
  displayError('No text was selected');
}