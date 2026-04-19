
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ pong: true });
    return false;
  }

  if (request.action === 'getSelectedText') {
    const selectedText = window.getSelection().toString().trim();
    sendResponse({ text: selectedText });
    return false;
  }

  if (request.action === 'extractPageText') {
    try {
      const pageText = extractVisibleText();
      sendResponse({ success: true, text: pageText });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }

  if (request.action === 'highlightClaims') {
    try {
      highlightSuspiciousClaims(request.claims);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }

  return false;
});

let lastSelection = '';

document.addEventListener('mouseup', () => {
  const selection = window.getSelection().toString().trim();
  if (selection && selection !== lastSelection) {
    lastSelection = selection;
  }
});

document.addEventListener('mousedown', () => {
  lastSelection = '';
});

function extractVisibleText() {
  const contentSelectors = ['article', 'main', '[role="main"]', '.content', '.post', '.article', 'body'];

  let content = null;
  for (const selector of contentSelectors) {
    content = document.querySelector(selector);
    if (content) break;
  }
  if (!content) content = document.body;

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

        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textParts = [];
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (text) textParts.push(text);
  }

  return textParts.join(' ').substring(0, 50000);
}

function highlightSuspiciousClaims(claims) {
  removeExistingHighlights();

  if (!document.getElementById('factcheck-ai-styles')) {
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
      .factcheck-ai-tooltip-reason {
        font-style: italic;
        color: #666;
        font-size: 12px;
      }
    `;
    document.head.appendChild(style);
  }

  claims.forEach((claim, index) => {
    highlightTextInBody(claim.text, claim.reason, index);
  });
}

function highlightTextInBody(searchText, reason, claimIndex) {
  const searchLower = searchText.toLowerCase().trim();

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('.factcheck-ai-highlight')) return NodeFilter.FILTER_REJECT;
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

  textNodes.forEach(textNode => {
    highlightInTextNode(textNode, searchText, reason, claimIndex);
  });
}

function highlightInTextNode(textNode, searchText, reason, claimIndex) {
  const text = textNode.textContent;
  const textLower = text.toLowerCase();
  const searchLower = searchText.toLowerCase().trim();

  const matches = [];
  let startPos = 0;
  while (true) {
    const index = textLower.indexOf(searchLower, startPos);
    if (index === -1) break;
    matches.push({ start: index, end: index + searchText.length });
    startPos = index + 1;
  }

  if (matches.length === 0) return;

  const fragment = document.createDocumentFragment();
  let lastEnd = 0;

  matches.forEach((match, matchIndex) => {
    if (match.start > lastEnd) {
      fragment.appendChild(document.createTextNode(text.substring(lastEnd, match.start)));
    }

    const matchText = text.substring(match.start, match.end);
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'factcheck-ai-highlight';
    highlightSpan.textContent = matchText;

    const tooltipId = `factcheck-tooltip-${claimIndex}-${matchIndex}-${Date.now()}`;
    const tooltip = document.createElement('div');
    tooltip.className = 'factcheck-ai-tooltip';
    tooltip.id = tooltipId;
    tooltip.innerHTML = `
      <div class="factcheck-ai-tooltip-title">⚠️ Potencjalna dezinformacja</div>
      <div class="factcheck-ai-tooltip-reason">${reason}</div>
      <div style="margin-top:6px;font-size:11px;color:#999;">Zaznacz i kliknij prawym → "Sprawdź prawdziwość"</div>
    `;

    highlightSpan.addEventListener('mouseenter', () => {
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
      if (tt) tt.style.display = 'none';
    });

    fragment.appendChild(highlightSpan);
    document.body.appendChild(tooltip);

    lastEnd = match.end;
  });

  if (lastEnd < text.length) {
    fragment.appendChild(document.createTextNode(text.substring(lastEnd)));
  }

  textNode.parentNode.replaceChild(fragment, textNode);
}

function removeExistingHighlights() {
  document.querySelectorAll('.factcheck-ai-highlight').forEach(highlight => {
    const textNode = document.createTextNode(highlight.textContent);
    highlight.parentNode.replaceChild(textNode, highlight);
  });
  document.querySelectorAll('.factcheck-ai-tooltip').forEach(tooltip => tooltip.remove());
}



