// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('FactCheck AI: Extension installed, creating context menu');
  chrome.contextMenus.create({
    id: 'factcheck',
    title: chrome.i18n.getMessage('contextMenuTitle'),
    contexts: ['selection']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('FactCheck AI: Error creating context menu:', chrome.runtime.lastError);
    } else {
      console.log('FactCheck AI: Context menu created successfully');
    }
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('FactCheck AI: Context menu clicked', info);
  
  if (info.menuItemId === 'factcheck') {
    const selectedText = info.selectionText;
    console.log('FactCheck AI: Selected text:', selectedText);
    
    // Check if API key is set
    const result = await chrome.storage.sync.get(['tavilyApiKey']); // Zmienione z googleApiKey
    console.log('FactCheck AI: API key check:', result.tavilyApiKey ? 'Key exists' : 'No key');
    
    if (!result.tavilyApiKey) {
      // Show alert if no API key
      console.log('FactCheck AI: No API key, showing alert');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (message) => {
            alert(message);
          },
          args: [chrome.i18n.getMessage('noApiKey')]
        });
      } catch (error) {
        console.error('FactCheck AI: Error showing alert:', error);
      }
      return;
    }
    
    // Store selected text and switch popup to factcheck view
    console.log('FactCheck AI: Storing text and opening popup');
    try {
      await chrome.storage.local.set({ 
        selectedText: selectedText,
        timestamp: Date.now(),
        showFactCheck: true
      });
      
      // Temporarily change popup to factcheck.html
      await chrome.action.setPopup({ popup: 'factcheck.html' });
      
      // Open the popup programmatically
      await chrome.action.openPopup();
      
      // Reset popup back to default after a delay
      setTimeout(async () => {
        await chrome.action.setPopup({ popup: 'popup.html' });
      }, 1000);
      
      console.log('FactCheck AI: Popup opened');
    } catch (error) {
      console.error('FactCheck AI: Error opening popup:', error);
    }
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('FactCheck AI: Message received:', request);
  
  if (request.action === 'factcheck') {
    performFactCheck(request.text).then(response => {
      console.log('FactCheck AI: Sending response:', response);
      sendResponse(response);
    }).catch(error => {
      console.error('FactCheck AI: Error in performFactCheck:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    });
    return true; // Keep channel open for async response
  }
});

// Perform fact-checking using Google Fact Check Tools API
async function performFactCheck(text) {
  console.log('FactCheck AI (Tavily): Starting search for:', text);
  
  try {
    const result = await chrome.storage.sync.get(['tavilyApiKey']);
    const apiKey = result.tavilyApiKey;
    
    if (!apiKey) {
      throw new Error('Tavily API key not set in extension settings');
    }
    
    // Zapytanie do Tavily API
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: `Verify the following claim: "${text}"`,
        search_depth: "advanced",
        include_answer: true,
        max_results: 5
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Tavily API request failed');
    }
    
    const data = await response.json();
    
    // Mapowanie wyników Tavily na format Twojego interfejsu
    const analysis = data.answer || "No direct answer from AI, check sources below.";
    
    const sources = data.results.map(res => ({
      type: 'url',
      value: res.url,
      publisher: res.title,
      rating: `Score: ${Math.round(res.score * 100)}%`
    }));

    // Próba automatycznego określenia werdyktu na podstawie odpowiedzi AI
    let verdict = 'unknown';
    const lowerAnswer = analysis.toLowerCase();
    if (lowerAnswer.includes('false') || lowerAnswer.includes('incorrect') || lowerAnswer.includes('myth')) verdict = 'false';
    else if (lowerAnswer.includes('true') || lowerAnswer.includes('correct') || lowerAnswer.includes('confirmed')) verdict = 'true';
    else if (lowerAnswer.includes('partially') || lowerAnswer.includes('mixed')) verdict = 'partial';

    return {
      success: true,
      analysis: analysis,
      sources: sources,
      verdict: verdict,
      api: 'Tavily AI Search API'
    };
    
  } catch (error) {
    console.error('FactCheck AI Error:', error);
    return { success: false, error: error.message };
  }
}
// Generate analysis summary from claims
function generateAnalysisSummary(claims) {
  if (claims.length === 0) {
    return 'No fact-check results found.';
  }
  
  let summary = `Found ${claims.length} fact-check result(s):\n\n`;
  
  claims.forEach((claim, index) => {
    summary += `${index + 1}. ${claim.publisher}\n`;
    summary += `   Rating: ${claim.textualRating}\n`;
    if (claim.title) {
      summary += `   Title: ${claim.title}\n`;
    }
    if (claim.claimant !== 'Unknown') {
      summary += `   Claimant: ${claim.claimant}\n`;
    }
    summary += `   Review Date: ${claim.reviewDate}\n\n`;
  });
  
  return summary;
}

// Determine overall verdict based on ratings
function determineVerdict(claims) {
  if (claims.length === 0) return 'unknown';
  
  const ratings = claims.map(c => c.textualRating.toLowerCase());
  
  // Check for false ratings
  if (ratings.some(r => r.includes('false') || r.includes('pants on fire') || r.includes('incorrect'))) {
    return 'false';
  }
  
  // Check for true ratings
  if (ratings.some(r => r.includes('true') || r.includes('correct') || r.includes('accurate'))) {
    // If there are mixed ratings, it's partially true
    if (ratings.some(r => r.includes('mostly') || r.includes('partially') || r.includes('mixture'))) {
      return 'partial';
    }
    return 'true';
  }
  
  // Check for partially true
  if (ratings.some(r => r.includes('mostly') || r.includes('partially') || r.includes('mixture') || r.includes('half'))) {
    return 'partial';
  }
  
  // Check for needs context
  if (ratings.some(r => r.includes('context') || r.includes('misleading') || r.includes('unproven'))) {
    return 'context';
  }
  
  return 'unknown';
}