const { authenticate } = require('../../src/middleware/auth');

describe('authenticate middleware', () => {
  const JWT_SECRET = 'test-secret';
  const jwt = require('jsonwebtoken');

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it('calls next() with valid Bearer token', () => {
    const token = jwt.sign({ id: 1, role: 'user' }, JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    const next = jest.fn();
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({ id: 1, role: 'user' });
  });

  it('returns 401 with no Authorization header', () => {
    const req = { headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with invalid token', () => {
    const req = { headers: { authorization: 'Bearer bad-token' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
