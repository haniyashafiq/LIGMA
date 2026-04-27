const jwt = require('jsonwebtoken');
const config = require('../config');

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function verifyAccessToken(token) {
  let payload;

  try {
    payload = jwt.verify(token, config.JWT_SECRET);
  } catch (_error) {
    throw createHttpError('Invalid or expired access token.', 401);
  }

  if (payload.type !== 'access' || !payload.id || !payload.username) {
    throw createHttpError('Invalid access token payload.', 401);
  }

  return {
    id: payload.id,
    username: payload.username,
  };
}

function authenticateRequest(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch (error) {
    return res.status(error.statusCode || 401).json({ message: error.message });
  }
}

function authenticateSocket(socket, next) {
  const token = socket?.handshake?.auth?.token;

  if (!token) {
    return next(new Error('Authentication required.'));
  }

  try {
    socket.user = verifyAccessToken(token);
    return next();
  } catch (_error) {
    return next(new Error('Invalid or expired access token.'));
  }
}

module.exports = {
  extractBearerToken,
  verifyAccessToken,
  authenticateRequest,
  authenticateSocket,
};
