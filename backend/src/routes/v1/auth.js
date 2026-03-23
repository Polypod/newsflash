const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// POST /api/v1/auth/login
// Body: { username: string, password: string }
// Returns: { token: string }
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const expectedUser = process.env.API_USERNAME || 'admin';
  const expectedPass = process.env.API_PASSWORD;

  if (!expectedPass || username !== expectedUser || password !== expectedPass) {
    return res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Invalid credentials' });
  }

  const token = jwt.sign({ role: 'user' }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

module.exports = router;
