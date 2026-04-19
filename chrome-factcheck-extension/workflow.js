async function startFactCheckWorkflow(text) {
  try {
    const searchResults = await fetchTavilyData(text);
    const aiResult = await analyzeWithGemini(text, searchResults);
    
    const sourcesWithNotes = searchResults.map((s, index) => ({
      type: 'url',
      value: s.url,
      publisher: s.title,
      rating: `Score: ${Math.round(s.score * 100)}%`,
      note: aiResult.sourceSummaries[index] 
    }));

    return {
      success: true,
      analysis: aiResult.analysisText,
      verdict: aiResult.verdict,
      sources: sourcesWithNotes,
      api: "Tavily + Gemini Pipeline"
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}