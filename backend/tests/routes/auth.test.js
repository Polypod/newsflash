const request = require('supertest');
const app = require('../../src/app');
const jwt = require('jsonwebtoken');

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.API_USERNAME = 'admin';
    process.env.API_PASSWORD = 'password';
  });

  it('returns 200 with token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'password' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    const decoded = jwt.verify(res.body.token, 'test-secret');
    expect(decoded.role).toBe('user');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});
