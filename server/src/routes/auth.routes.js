const express = require('express');
const config = require('../config');
const authService = require('../services/auth.service');
const { authenticateRequest } = require('../middleware/auth');

const router = express.Router();

const REFRESH_COOKIE_NAME = 'ligma_refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
}

function validateCredentialsInput(username, password) {
  if (typeof username !== 'string' || username.length < 3 || username.length > 50) {
    return 'Username must be between 3 and 50 characters.';
  }

  if (typeof password !== 'string' || password.length < 6) {
    return 'Password must be at least 6 characters.';
  }

  return null;
}

router.post('/register', async (req, res) => {
  const { username, password, displayName } = req.body || {};
  const validationError = validateCredentialsInput(username, password);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const result = await authService.register(
      username.trim(),
      password,
      typeof displayName === 'string' ? displayName.trim() : null
    );

    setRefreshCookie(res, result.refreshToken);

    return res.status(201).json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to register user.',
    });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const validationError = validateCredentialsInput(username, password);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const result = await authService.login(username.trim(), password);
    setRefreshCookie(res, result.refreshToken);

    return res.status(200).json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to log in.',
    });
  }
});

router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token is required.' });
  }

  try {
    const result = await authService.refresh(refreshToken);

    return res.status(200).json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    clearRefreshCookie(res);
    return res.status(error.statusCode || 500).json({
      message: error.message || 'Failed to refresh access token.',
    });
  }
});

router.post('/logout', async (_req, res) => {
  await authService.logout();
  clearRefreshCookie(res);

  return res.status(200).json({ ok: true });
});

router.get('/me', authenticateRequest, (req, res) => {
  return res.status(200).json({ user: req.user });
});

module.exports = router;
