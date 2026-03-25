const http = require('http');
const { Server } = require('socket.io');
const { io: ioc } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-secret';

function createTestServer() {
  const httpServer = http.createServer();
  // Minimal SocketHandler recreation for test
  const SocketHandler = require('../../src/websocket/socketHandler');
  const handler = new SocketHandler(httpServer, { quit: jest.fn() });
  return { httpServer, handler };
}

describe('WebSocket auth', () => {
  let httpServer, handler, port;

  beforeAll((done) => {
    process.env.JWT_SECRET = JWT_SECRET;
    ({ httpServer, handler } = createTestServer());
    httpServer.listen(() => {
      port = httpServer.address().port;
      done();
    });
  });

  afterAll((done) => {
    handler.io.close(done);
  });

  it('disconnects client with no token', (done) => {
    const client = ioc(`http://localhost:${port}`, { auth: {} });
    client.on('disconnect', () => {
      done();
    });
    client.on('connect', () => {
      // Should not reach here — expect disconnect
    });
  });

  it('accepts client with valid token', (done) => {
    const token = jwt.sign({ role: 'user' }, JWT_SECRET);
    const client = ioc(`http://localhost:${port}`, { auth: { token } });
    client.on('connect', () => {
      client.disconnect();
      done();
    });
    client.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        done(new Error('Server rejected valid token'));
      }
    });
  });
});

describe('broadcastNewsflash', () => {
  let httpServer, handler, port;

  beforeAll((done) => {
    process.env.JWT_SECRET = JWT_SECRET;
    ({ httpServer, handler } = createTestServer());
    httpServer.listen(() => {
      port = httpServer.address().port;
      done();
    });
  });

  afterAll((done) => {
    handler.io.close(done);
  });

  it('broadcasts newsflash event to news room with all expected fields', (done) => {
    const token = jwt.sign({ role: 'user' }, JWT_SECRET);
    const client = ioc(`http://localhost:${port}`, { auth: { token } });

    const mockArticle = {
      id: 42,
      title: 'Test Critical Headline',
      source: 'Reuters',
      url: 'https://reuters.com/test',
      criticality_score: 92,
      criticality_reason: 'Active military conflict',
      published_at: new Date('2026-03-24T10:00:00Z'),
    };

    client.on('connect', () => {
      // Subscribe to news room
      client.emit('subscribe', 'news');

      // Set up event listener for newsflash (register before broadcast)
      client.on('newsflash', (payload) => {
        try {
          // Verify all expected fields are present
          expect(payload.id).toBe(mockArticle.id);
          expect(payload.title).toBe(mockArticle.title);
          expect(payload.source).toBe(mockArticle.source);
          expect(payload.url).toBe(mockArticle.url);
          expect(payload.criticality_score).toBe(mockArticle.criticality_score);
          expect(payload.criticality_reason).toBe(mockArticle.criticality_reason);
          // published_at is serialized to ISO string by Socket.io
          expect(payload.published_at).toBe(mockArticle.published_at.toISOString());

          // Verify timestamp is a string (ISO format)
          expect(typeof payload.timestamp).toBe('string');
          expect(/^\d{4}-\d{2}-\d{2}T/.test(payload.timestamp)).toBe(true);

          client.disconnect();
          done();
        } catch (error) {
          client.disconnect();
          done(error);
        }
      });

      // Small delay to ensure subscription is registered on server
      setTimeout(() => {
        handler.broadcastNewsflash(mockArticle);
      }, 100);
    });

    client.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        done(new Error('Server rejected valid token'));
      }
    });
  }, 10000);
});
