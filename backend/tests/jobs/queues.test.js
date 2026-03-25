// Mock Bull before any require so queues.js uses the mock constructor.
// Each new Queue(name, ...) returns a distinct mock with its own add/process/on.
jest.mock('bull', () => {
  return jest.fn().mockImplementation((name) => ({
    add: jest.fn().mockResolvedValue({}),
    process: jest.fn(),
    on: jest.fn(),
  }));
});

jest.mock('../../src/config/env', () => ({
  redisUrl: 'redis://localhost:6379',
  newsApiEnabled: false,   // ← what we're testing
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const Bull = require('bull');
const { scheduleJobs } = require('../../src/jobs/queues');

describe('scheduleJobs with newsApiEnabled=false', () => {
  // Run scheduleJobs once; check queue instances via Bull.mock
  beforeAll(() => {
    scheduleJobs(null);
  });

  it('does not call headlinesQueue.add for either the repeat or startup job', () => {
    const idx = Bull.mock.calls.findIndex(([name]) => name === 'newsapi-headlines');
    expect(idx).toBeGreaterThanOrEqual(0);
    const headlinesInstance = Bull.mock.results[idx].value;
    expect(headlinesInstance.add).not.toHaveBeenCalled();
  });

  it('still schedules acled-conflicts', () => {
    const idx = Bull.mock.calls.findIndex(([name]) => name === 'acled-conflicts');
    expect(idx).toBeGreaterThanOrEqual(0);
    const conflictsInstance = Bull.mock.results[idx].value;
    expect(conflictsInstance.add).toHaveBeenCalled();
  });
});
