const axios = require('axios');
const Parser = require('rss-parser');
const logger = require('../utils/logger');
const config = require('../config/env');

class NewsService {
  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'SituationalAwarenessMVP/1.0'
      }
    });
    
    // 30+ News sources configuration
    this.sources = [
      // International News
      { name: 'Reuters', type: 'rss', url: 'https://feeds.reuters.com/reuters/worldNews', category: 'geopolitical' },
      { name: 'Associated Press', type: 'rss', url: 'https://rsshub.app/apnews/topics/apf-topnews', category: 'geopolitical' },
      { name: 'BBC World', type: 'rss', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', category: 'geopolitical' },
      { name: 'Al Jazeera', type: 'rss', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'geopolitical' },
      { name: 'CNN World', type: 'rss', url: 'http://rss.cnn.com/rss/edition_world.rss', category: 'geopolitical' },
      { name: 'France24', type: 'rss', url: 'https://www.france24.com/en/rss', category: 'geopolitical' },
      { name: 'Deutsche Welle', type: 'rss', url: 'https://rss.dw.com/rdf/rss-en-all', category: 'geopolitical' },
      
      // Conflict & Security
      { name: 'Defense One', type: 'rss', url: 'https://www.defenseone.com/rss/', category: 'military' },
      { name: 'The Defense Post', type: 'rss', url: 'https://thedefensepost.com/feed/', category: 'military' },
      { name: 'War on the Rocks', type: 'rss', url: 'https://warontherocks.com/feed/', category: 'military' },
      
      // Energy & Infrastructure
      { name: 'Oil Price', type: 'rss', url: 'https://oilprice.com/rss/main', category: 'energy' },
      { name: 'Reuters Energy', type: 'rss', url: 'https://feeds.reuters.com/reuters/businessNews', category: 'energy' },
      { name: 'Bloomberg Energy', type: 'rss', url: 'https://feeds.bloomberg.com/energy/news.rss', category: 'energy' },
      
      // Technology & Cyber
      { name: 'The Hacker News', type: 'rss', url: 'https://feeds.feedburner.com/TheHackersNews', category: 'cyber' },
      { name: 'Krebs on Security', type: 'rss', url: 'https://krebsonsecurity.com/feed/', category: 'cyber' },
      { name: 'Dark Reading', type: 'rss', url: 'https://www.darkreading.com/rss.xml', category: 'cyber' },
      
      // Regional Sources
      { name: 'Kyiv Independent', type: 'rss', url: 'https://kyivindependent.com/feed/', category: 'geopolitical' },
      { name: 'Times of Israel', type: 'rss', url: 'https://www.timesofisrael.com/feed/', category: 'geopolitical' },
      { name: 'The National (UAE)', type: 'rss', url: 'https://www.thenationalnews.com/rss', category: 'geopolitical' },
      { name: 'South China Morning Post', type: 'rss', url: 'https://www.scmp.com/rss/5/feed', category: 'geopolitical' },
      { name: 'Japan Times', type: 'rss', url: 'https://www.japantimes.co.jp/feed/', category: 'geopolitical' },
      
      // Economic & Trade
      { name: 'Financial Times', type: 'rss', url: 'https://www.ft.com/rss/home', category: 'trade' },
      { name: 'Wall Street Journal', type: 'rss', url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', category: 'trade' },
      { name: 'The Economist', type: 'rss', url: 'https://www.economist.com/international/rss.xml', category: 'trade' },
      
      // Humanitarian
      { name: 'UN News', type: 'rss', url: 'https://news.un.org/feed/subscribe/en/news/region/all/rss.xml', category: 'humanitarian' },
      { name: 'ReliefWeb', type: 'rss', url: 'https://reliefweb.int/updates/rss.xml', category: 'humanitarian' },
      { name: 'ICRC', type: 'rss', url: 'https://www.icrc.org/en/rss', category: 'humanitarian' },
      
      // Telegram OSINT Channels (simulated via RSS bridges)
      { name: 'Intel Crab', type: 'rss', url: 'https://rsshub.app/telegram/channel/intel_slava', category: 'osint' },
      { name: 'War Monitor', type: 'rss', url: 'https://rsshub.app/telegram/channel/warmonitors', category: 'osint' },
      { name: 'Ukraine Weapons', type: 'rss', url: 'https://rsshub.app/telegram/channel/ukraine_weapons', category: 'osint' },
      
      // Think Tanks
      { name: 'CSIS', type: 'rss', url: 'https://www.csis.org/rss.xml', category: 'analysis' },
      { name: 'Brookings', type: 'rss', url: 'https://www.brookings.edu/feed/', category: 'analysis' },
      { name: 'Chatham House', type: 'rss', url: 'https://www.chathamhouse.org/rss.xml', category: 'analysis' }
    ];
  }

  async fetchAllNews() {
    const allArticles = [];
    const errors = [];

    logger.info(`Starting news fetch from ${this.sources.length} sources`);

    for (const source of this.sources) {
      try {
        const articles = await this.fetchFromSource(source);
        allArticles.push(...articles);
        logger.debug(`Fetched ${articles.length} articles from ${source.name}`);
      } catch (error) {
        errors.push({ source: source.name, error: error.message });
        logger.warn(`Failed to fetch from ${source.name}: ${error.message}`);
      }
    }

    logger.info(`News fetch complete: ${allArticles.length} articles from ${this.sources.length - errors.length} sources`);
    
    if (errors.length > 0) {
      logger.warn(`${errors.length} sources failed:`, errors.map(e => e.source).join(', '));
    }

    return allArticles;
  }

  async fetchFromSource(source) {
    const articles = [];

    if (source.type === 'rss') {
      try {
        const feed = await this.parser.parseURL(source.url);
        
        for (const item of feed.items.slice(0, 10)) { // Limit to 10 most recent per source
          articles.push({
            source: source.name,
            external_id: item.guid || item.link || `${source.name}_${Date.now()}`,
            title: item.title || 'No Title',
            content: item.contentSnippet || item.content || item.summary || '',
            url: item.link || '',
            published_at: item.pubDate ? new Date(item.pubDate) : new Date(),
            category: source.category,
            author: item.creator || item.author || 'Unknown'
          });
        }
      } catch (error) {
        throw new Error(`RSS parse error: ${error.message}`);
      }
    }

    return articles;
  }

  async fetchFromNewsAPI(query, options = {}) {
    const { pageSize = 20, language = 'en' } = options;
    
    try {
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: query,
          pageSize,
          language,
          sortBy: 'publishedAt',
          apiKey: config.newsApiKey
        }
      });

      if (response.data && response.data.articles) {
        return response.data.articles.map(article => ({
          source: article.source?.name || 'NewsAPI',
          external_id: article.url || `newsapi_${Date.now()}`,
          title: article.title || 'No Title',
          content: article.description || article.content || '',
          url: article.url || '',
          published_at: article.publishedAt ? new Date(article.publishedAt) : new Date(),
          category: 'geopolitical',
          author: article.author || 'Unknown'
        }));
      }
      
      return [];
    } catch (error) {
      logger.error('Error fetching from NewsAPI:', error.message);
      return [];
    }
  }

  async fetchFromGDELT(options = {}) {
    const { timespan = '24h', maxRecords = 50 } = options;
    
    try {
      const response = await axios.get('https://api.gdeltproject.org/api/v2/doc/doc', {
        params: {
          query: 'theme:CONFLICT OR theme:ENERGY OR theme:MILITARY',
          mode: 'artlist',
          maxrecords: maxRecords,
          timespan,
          format: 'json'
        }
      });

      if (response.data && response.data.articles) {
        return response.data.articles.map(article => ({
          source: 'GDELT',
          external_id: article.url || `gdelt_${Date.now()}`,
          title: article.title || 'No Title',
          content: article.seenindate || '',
          url: article.url || '',
          published_at: article.seendate ? new Date(article.seendate) : new Date(),
          category: 'geopolitical',
          author: article.domain || 'Unknown'
        }));
      }
      
      return [];
    } catch (error) {
      logger.error('Error fetching from GDELT:', error.message);
      return [];
    }
  }

  deduplicateArticles(articles) {
    const seen = new Set();
    return articles.filter(article => {
      const key = article.external_id || article.url;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async fetchAndProcess() {
    const startTime = Date.now();
    
    // Fetch from all RSS sources
    const rssArticles = await this.fetchAllNews();
    
    // Fetch from NewsAPI if configured
    let newsApiArticles = [];
    if (config.newsApiKey) {
      newsApiArticles = await this.fetchFromNewsAPI('geopolitical OR conflict OR energy');
    }
    
    // Fetch from GDELT
    const gdeltArticles = await this.fetchFromGDELT();
    
    // Combine all articles
    const allArticles = [...rssArticles, ...newsApiArticles, ...gdeltArticles];
    
    // Deduplicate
    const uniqueArticles = this.deduplicateArticles(allArticles);
    
    const duration = Date.now() - startTime;
    logger.info(`News processing complete: ${uniqueArticles.length} unique articles in ${duration}ms`);
    
    return uniqueArticles;
  }
}

module.exports = new NewsService();
