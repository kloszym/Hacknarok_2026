importScripts('tavily.js', 'gemini_module.js', 'workflow.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'factcheck',
    title: "Sprawdź prawdziwość",
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'factcheck') {
    const selectedText = info.selectionText;

    await chrome.storage.local.set({ selectedText, timestamp: Date.now() });
    
    chrome.action.setPopup({ popup: 'factcheck.html' });
    chrome.action.openPopup();
    setTimeout(() => chrome.action.setPopup({ popup: 'popup.html' }), 1000);
  }
});

// Nasłuchiwanie wiadomości z frontendu (factcheck.js)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'factcheck') {
    // GŁÓWNY WORKFLOW
    startFactCheckWorkflow(request.text).then(sendResponse);
    return true; 
  }

  if (request.action === 'analyzePageWithGemini') {
    analyzePageWithGemini(request.text, request.url)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});