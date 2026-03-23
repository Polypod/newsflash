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

  afterAll(() => httpServer.close());

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
