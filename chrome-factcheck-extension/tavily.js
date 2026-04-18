// tavily.js
export async function fetchTavilyData(query) {
  const keys = await chrome.storage.sync.get(['tavilyApiKey']);
  if (!keys.tavilyApiKey) throw new Error('Brak klucza Tavily');

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: keys.tavilyApiKey,
      query: query,
      search_depth: "advanced",
      max_results: 5
    })
  });

  if (!response.ok) throw new Error('Błąd API Tavily');
  
  const data = await response.json();
  
  // Zwracamy czyste wyniki (tytuły, linki, treść)
  return data.results.map(r => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score
  }));
}