// Mock the SDK before requiring the service
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

process.env.ANTHROPIC_API_KEY = 'test-key';
const { scoreHeadline } = require('../../src/services/scoringService');

describe('scoreHeadline', () => {
  it('returns score and reason from tool use response', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use',
        name: 'score_headline',
        input: { score: 87, reason: 'Active military conflict with state actors' },
      }],
    });

    const result = await scoreHeadline('NATO calls emergency summit', 'Amid escalating tensions...');
    expect(result).toEqual({ score: 87, reason: 'Active military conflict with state actors' });
  });

  it('returns fallback score 50 if no tool_use block in response', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'oops' }] });
    const result = await scoreHeadline('Weather forecast', '');
    expect(result).toEqual({ score: 50, reason: 'Scoring unavailable' });
  });

  it('returns fallback if SDK throws', async () => {
    mockCreate.mockRejectedValue(new Error('API error'));
    const result = await scoreHeadline('Title', 'Desc');
    expect(result).toEqual({ score: null, reason: null });
  });
});
