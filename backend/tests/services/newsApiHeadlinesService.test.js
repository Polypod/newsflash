const axios = require('axios');
jest.mock('axios');

// Must set before require so env.js picks it up
process.env.NEWS_API_KEY = 'test-key';
const newsApiHeadlinesService = require('../../src/services/newsApiHeadlinesService');

const makeArticle = (url, title) => ({
  source: { name: 'Reuters' },
  title,
  description: 'A description',
  url,
  publishedAt: '2026-03-24T10:00:00Z',
  author: 'John Doe',
});

describe('newsApiHeadlinesService.fetchTopHeadlines', () => {
  beforeEach(() => {
    axios.get.mockReset();
  });

  it('makes three category requests and merges results', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { articles: [makeArticle('http://a1.com', 'A1')] } })
      .mockResolvedValueOnce({ data: { articles: [makeArticle('http://a2.com', 'A2')] } })
      .mockResolvedValueOnce({ data: { articles: [makeArticle('http://a3.com', 'A3')] } });
    const results = await newsApiHeadlinesService.fetchTopHeadlines();
    expect(axios.get).toHaveBeenCalledTimes(3);
    expect(results.length).toBe(3); // one per category (no overlap)
  });

  it('deduplicates articles with the same URL', async () => {
    const duplicate = makeArticle('http://same.com', 'Same');
    axios.get.mockResolvedValue({ data: { articles: [duplicate] } });
    const results = await newsApiHeadlinesService.fetchTopHeadlines();
    expect(results.length).toBe(1); // deduplicated from 3 calls
  });

  it('maps articles to the standard shape', async () => {
    axios.get.mockResolvedValue({ data: { articles: [makeArticle('http://b.com', 'B')] } });
    const [article] = await newsApiHeadlinesService.fetchTopHeadlines();
    expect(article).toMatchObject({
      source: 'Reuters',
      external_id: 'http://b.com',
      title: 'B',
      content: 'A description',
      url: 'http://b.com',
      category: expect.stringMatching(/general|business|technology/),
      author: 'John Doe',
    });
    expect(article.published_at).toBeInstanceOf(Date);
  });

  it('returns empty array if NewsAPI returns non-200', async () => {
    axios.get.mockRejectedValue(new Error('Network Error'));
    const results = await newsApiHeadlinesService.fetchTopHeadlines();
    expect(results).toEqual([]);
  });
});
