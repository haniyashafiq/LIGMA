const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../db/pool');

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    color: row.color,
  };
}

function signAccessToken(user) {
  return jwt.sign(
    {
      type: 'access',
      id: user.id,
      username: user.username,
    },
    config.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    {
      type: 'refresh',
      id: user.id,
      username: user.username,
    },
    config.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

async function getUserByUsername(username) {
  const result = await pool.query(
    `
      SELECT id, username, password_hash, display_name, color
      FROM users
      WHERE username = $1
      LIMIT 1
    `,
    [username]
  );

  return result.rows[0] || null;
}

async function getUserById(id) {
  const result = await pool.query(
    `
      SELECT id, username, display_name, color
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function register(username, password, displayName) {
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await pool.query(
      `
        INSERT INTO users (username, password_hash, display_name)
        VALUES ($1, $2, $3)
        RETURNING id, username, display_name, color
      `,
      [username, passwordHash, displayName || null]
    );

    const user = mapUser(result.rows[0]);

    return {
      user,
      accessToken: signAccessToken(user),
      refreshToken: signRefreshToken(user),
    };
  } catch (error) {
    if (error.code === '23505') {
      throw createHttpError('Username is already in use.', 409);
    }

    throw error;
  }
}

async function login(username, password) {
  const userRow = await getUserByUsername(username);

  if (!userRow) {
    throw createHttpError('Invalid username or password.', 401);
  }

  const isValidPassword = await bcrypt.compare(password, userRow.password_hash);

  if (!isValidPassword) {
    throw createHttpError('Invalid username or password.', 401);
  }

  const user = mapUser(userRow);

  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

async function refresh(refreshToken) {
  let payload;

  try {
    payload = jwt.verify(refreshToken, config.JWT_SECRET);
  } catch (_error) {
    throw createHttpError('Invalid or expired refresh token.', 401);
  }

  if (payload.type !== 'refresh' || !payload.id) {
    throw createHttpError('Invalid refresh token payload.', 401);
  }

  const userRow = await getUserById(payload.id);

  if (!userRow) {
    throw createHttpError('User no longer exists.', 401);
  }

  const user = mapUser(userRow);

  return {
    user,
    accessToken: signAccessToken(user),
  };
}

async function logout() {
  return;
}

module.exports = {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  register,
  login,
  refresh,
  logout,
};
