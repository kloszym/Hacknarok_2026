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
    const result = await chrome.storage.sync.get(['googleApiKey']);
    console.log('FactCheck AI: API key check:', result.googleApiKey ? 'Key exists' : 'No key');
    
    if (!result.googleApiKey) {
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
  console.log('FactCheck AI: Starting fact-check for:', text);
  
  try {
    const result = await chrome.storage.sync.get(['googleApiKey']);
    const apiKey = result.googleApiKey;
    
    if (!apiKey) {
      throw new Error('API key not set');
    }
    
    // Use Google Fact Check Tools API
    const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(text)}&key=${apiKey}`;
    console.log('FactCheck AI: Fetching from API:', url.replace(apiKey, 'HIDDEN'));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('FactCheck AI: API response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('FactCheck AI: API error:', errorData);
      throw new Error(errorData.error?.message || 'API request failed');
    }
    
    const data = await response.json();
    console.log('FactCheck AI: API data:', data);
    
    // Process the response
    if (!data.claims || data.claims.length === 0) {
      console.log('FactCheck AI: No claims found');
      return {
        success: true,
        analysis: 'No fact-check results found for this claim. This doesn\'t necessarily mean the statement is false - it may simply not have been fact-checked yet by major organizations.',
        sources: [],
        claims: [],
        verdict: 'unknown'
      };
    }
    
    // Extract claims and their reviews
    const claims = data.claims.map(claim => {
      const claimReview = claim.claimReview?.[0] || {};
      return {
        text: claim.text || text,
        claimant: claim.claimant || 'Unknown',
        claimDate: claim.claimDate || 'Unknown',
        publisher: claimReview.publisher?.name || 'Unknown',
        url: claimReview.url || '',
        title: claimReview.title || '',
        reviewDate: claimReview.reviewDate || 'Unknown',
        textualRating: claimReview.textualRating || 'No rating',
        languageCode: claimReview.languageCode || 'en'
      };
    });
    
    console.log('FactCheck AI: Processed claims:', claims);
    
    // Generate analysis summary
    const analysis = generateAnalysisSummary(claims);
    
    // Extract sources
    const sources = claims
      .filter(claim => claim.url)
      .map(claim => ({
        type: 'url',
        value: claim.url,
        publisher: claim.publisher,
        rating: claim.textualRating
      }));
    
    // Determine overall verdict
    const verdict = determineVerdict(claims);
    
    const factCheckResult = {
      success: true,
      analysis: analysis,
      sources: sources,
      claims: claims,
      verdict: verdict,
      api: 'Google Fact Check Tools API'
    };
    
    console.log('FactCheck AI: Returning result:', factCheckResult);
    return factCheckResult;
    
  } catch (error) {
    console.error('FactCheck AI: Fact-check error:', error);
    return {
      success: false,
      error: error.message
    };
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