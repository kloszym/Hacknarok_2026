// Content script dla obsługi zaznaczania tekstu i interakcji
// Ten skrypt działa na wszystkich stronach

console.log('[CONTENT] Content script załadowany');

// Nasłuchuj wiadomości z background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[CONTENT] Otrzymano wiadomość:', request.action);
  
  if (request.action === 'ping') {
    console.log('[CONTENT] Akcja: ping - odpowiadam pong');
    sendResponse({ pong: true });
    return false;
  }
  
  if (request.action === 'getSelectedText') {
    console.log('[CONTENT] Akcja: getSelectedText');
    const selectedText = window.getSelection().toString().trim();
    console.log('[CONTENT] Zaznaczony tekst (długość):', selectedText.length);
    sendResponse({ text: selectedText });
    return false;
  }
  
  if (request.action === 'extractPageText') {
    console.log('[CONTENT] Akcja: extractPageText - START');
    try {
      const pageText = extractVisibleText();
      console.log('[CONTENT] Tekst wyciągnięty (długość):', pageText.length);
      sendResponse({ success: true, text: pageText });
      console.log('[CONTENT] Odpowiedź wysłana');
    } catch (error) {
      console.error('[CONTENT] Błąd wyciągania tekstu:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }
  
  if (request.action === 'highlightClaims') {
    console.log('[CONTENT] Akcja: highlightClaims');
    console.log('[CONTENT] Liczba twierdzeń do zaznaczenia:', request.claims?.length);
    try {
      highlightSuspiciousClaims(request.claims);
      console.log('[CONTENT] Zaznaczenia dodane pomyślnie');
      sendResponse({ success: true });
    } catch (error) {
      console.error('[CONTENT] Błąd zaznaczania twierdzeń:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }
  
  console.log('[CONTENT] Nieznana akcja:', request.action);
  return false;
});

// Wyciągnij widoczny tekst ze strony
function extractVisibleText() {
  console.log('[CONTENT] extractVisibleText: Rozpoczynam wyciąganie tekstu...');
  
  const contentSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.content',
    '.post',
    '.article',
    'body'
  ];
  
  let content = null;
  for (const selector of contentSelectors) {
    content = document.querySelector(selector);
    if (content) {
      console.log('[CONTENT] Znaleziono kontener:', selector);
      break;
    }
  }
  
  if (!content) {
    content = document.body;
    console.log('[CONTENT] Używam document.body jako kontenera');
  }
  
  const walker = document.createTreeWalker(
    content,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        const tagName = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'iframe'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        
        if (!node.textContent.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  const textParts = [];
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (text) {
      textParts.push(text);
    }
  }
  
  const fullText = textParts.join(' ').substring(0, 50000);
  console.log('[CONTENT] Wyciągnięto fragmentów tekstu:', textParts.length);
  console.log('[CONTENT] Całkowita długość tekstu:', fullText.length);
  
  return fullText;
}

// Zaznacz podejrzane twierdzenia na stronie
function highlightSuspiciousClaims(claims) {
  console.log('[CONTENT] highlightSuspiciousClaims: Rozpoczynam zaznaczanie...');
  console.log('[CONTENT] Twierdzenia do zaznaczenia:', claims);
  
  removeExistingHighlights();
  
  if (!document.getElementById('factcheck-ai-styles')) {
    console.log('[CONTENT] Tworzę style dla zaznaczenia...');
    const style = document.createElement('style');
    style.id = 'factcheck-ai-styles';
    style.textContent = `
      .factcheck-ai-highlight {
        background-color: rgba(255, 0, 0, 0.2) !important;
        border-bottom: 2px solid #ff0000 !important;
        cursor: help !important;
        position: relative !important;
      }
      .factcheck-ai-tooltip {
        position: absolute;
        background: #fff;
        border: 2px solid #ff0000;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 999999;
        max-width: 300px;
        font-size: 13px;
        line-height: 1.4;
        color: #333;
        display: none;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }
      .factcheck-ai-tooltip-title {
        font-weight: bold;
        color: #d32f2f;
        margin-bottom: 8px;
        font-size: 14px;
      }
      .factcheck-ai-tooltip-text {
        margin-bottom: 8px;
      }
      .factcheck-ai-tooltip-reason {
        font-style: italic;
        color: #666;
        font-size: 12px;
      }
    `;
    document.head.appendChild(style);
    console.log('[CONTENT] Style dodane');
  }
  
  // Zaznacz każde twierdzenie - NOWA STRATEGIA: przeszukaj WSZYSTKIE węzły tekstowe
  claims.forEach((claim, index) => {
    console.log(`[CONTENT] Zaznaczam twierdzenie ${index + 1}/${claims.length}:`, claim.text.substring(0, 50) + '...');
    highlightTextInBody(claim.text, claim.reason, index);
  });
  
  console.log('[CONTENT] Zaznaczanie zakończone');
}

// Zaznacz tekst w całym body - UPROSZCZONA WERSJA
function highlightTextInBody(searchText, reason, claimIndex) {
  const searchLower = searchText.toLowerCase().trim();
  
  console.log(`[CONTENT] Szukam tekstu dla twierdzenia ${claimIndex}:`, searchText.substring(0, 50));
  
  // Zbierz WSZYSTKIE węzły tekstowe w body
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        // Pomiń już zaznaczone
        if (parent.closest('.factcheck-ai-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Pomiń skrypty, style
        const tagName = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'iframe', 'svg'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.toLowerCase().includes(searchLower)) {
      textNodes.push(node);
    }
  }
  
  console.log(`[CONTENT] Znaleziono ${textNodes.length} węzłów tekstowych zawierających szukany tekst`);
  
  let totalHighlights = 0;
  textNodes.forEach(textNode => {
    const highlighted = highlightInTextNode(textNode, searchText, reason, claimIndex);
    totalHighlights += highlighted;
  });
  
  console.log(`[CONTENT] Utworzono ${totalHighlights} zaznaczenia dla twierdzenia ${claimIndex}`);
}

// Zaznacz tekst w konkretnym węźle tekstowym
function highlightInTextNode(textNode, searchText, reason, claimIndex) {
  const text = textNode.textContent;
  const textLower = text.toLowerCase();
  const searchLower = searchText.toLowerCase().trim();
  
  // Znajdź wszystkie wystąpienia
  const matches = [];
  let startPos = 0;
  
  while (true) {
    const index = textLower.indexOf(searchLower, startPos);
    if (index === -1) break;
    
    matches.push({
      start: index,
      end: index + searchText.length
    });
    
    startPos = index + 1;
  }
  
  if (matches.length === 0) return 0;
  
  console.log(`[CONTENT] Znaleziono ${matches.length} wystąpień w węźle tekstowym`);
  
  // Utwórz fragment z zaznaczeniami
  const fragment = document.createDocumentFragment();
  let lastEnd = 0;
  
  matches.forEach((match, matchIndex) => {
    // Tekst przed
    if (match.start > lastEnd) {
      fragment.appendChild(document.createTextNode(text.substring(lastEnd, match.start)));
    }
    
    // Zaznaczony tekst
    const matchText = text.substring(match.start, match.end);
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'factcheck-ai-highlight';
    highlightSpan.textContent = matchText;
    highlightSpan.dataset.claimIndex = claimIndex;
    highlightSpan.dataset.matchIndex = matchIndex;
    
    // Tooltip
    const tooltipId = `tooltip-${claimIndex}-${matchIndex}-${Date.now()}-${Math.random()}`;
    const tooltip = document.createElement('div');
    tooltip.className = 'factcheck-ai-tooltip';
    tooltip.id = tooltipId;
    tooltip.innerHTML = `
      <div class="factcheck-ai-tooltip-title">⚠️ Potencjalna dezinformacja</div>
      <div class="factcheck-ai-tooltip-text">"${matchText.substring(0, 100)}${matchText.length > 100 ? '...' : ''}"</div>
      <div class="factcheck-ai-tooltip-reason">${reason}</div>
      <div style="margin-top: 8px; font-size: 11px; color: #999;">Kliknij prawym przyciskiem i wybierz "Sprawdź prawdziwość" aby zweryfikować</div>
    `;
    
    // Hover events
    highlightSpan.addEventListener('mouseenter', (e) => {
      const tt = document.getElementById(tooltipId);
      if (tt) {
        tt.style.display = 'block';
        const rect = highlightSpan.getBoundingClientRect();
        tt.style.left = (rect.left + window.scrollX) + 'px';
        tt.style.top = (rect.bottom + window.scrollY + 5) + 'px';
      }
    });
    
    highlightSpan.addEventListener('mouseleave', () => {
      const tt = document.getElementById(tooltipId);
      if (tt) {
        tt.style.display = 'none';
      }
    });
    
    fragment.appendChild(highlightSpan);
    document.body.appendChild(tooltip);
    
    lastEnd = match.end;
  });
  
  // Tekst po
  if (lastEnd < text.length) {
    fragment.appendChild(document.createTextNode(text.substring(lastEnd)));
  }
  
  // Zastąp węzeł
  textNode.parentNode.replaceChild(fragment, textNode);
  
  return matches.length;
}

// Usuń istniejące zaznaczenia
function removeExistingHighlights() {
  console.log('[CONTENT] Usuwam istniejące zaznaczenia...');
  
  const highlights = document.querySelectorAll('.factcheck-ai-highlight');
  console.log('[CONTENT] Znaleziono zaznaczenia do usunięcia:', highlights.length);
  
  highlights.forEach(highlight => {
    const text = highlight.textContent;
    const textNode = document.createTextNode(text);
    highlight.parentNode.replaceChild(textNode, highlight);
  });
  
  const tooltips = document.querySelectorAll('.factcheck-ai-tooltip');
  console.log('[CONTENT] Znaleziono tooltipów do usunięcia:', tooltips.length);
  tooltips.forEach(tooltip => tooltip.remove());
}

console.log('[CONTENT] Content script gotowy do pracy');