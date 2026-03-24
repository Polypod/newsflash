const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../config/env');

const CATEGORIES = ['general', 'business', 'technology'];

async function fetchTopHeadlines() {
  if (!config.newsApiKey) {
    logger.warn('NEWS_API_KEY not set — skipping top-headlines fetch');
    return [];
  }

  const allArticles = [];

  for (const category of CATEGORIES) {
    try {
      const response = await axios.get('https://newsapi.org/v2/top-headlines', {
        params: {
          category,
          language: 'en',
          pageSize: 100,
          apiKey: config.newsApiKey,
        },
      });
      const articles = response.data?.articles || [];
      for (const a of articles) {
        allArticles.push({
          source: a.source?.name || 'NewsAPI',
          external_id: a.url || `newsapi_${Date.now()}`,
          title: a.title || 'No Title',
          content: a.description || a.content || '',
          url: a.url || '',
          published_at: a.publishedAt ? new Date(a.publishedAt) : new Date(),
          category,
          author: a.author || 'Unknown',
        });
      }
    } catch (err) {
      logger.warn(`NewsAPI top-headlines fetch failed for category ${category}: ${err.message}`);
    }
  }

  // Deduplicate by URL
  const seen = new Set();
  return allArticles.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

module.exports = { fetchTopHeadlines };
