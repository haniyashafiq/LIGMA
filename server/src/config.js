const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false });

const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'CLIENT_URL'];
const missingVars = requiredVars.filter((name) => !process.env[name]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

const parsedPort = Number(process.env.PORT || 3000);

if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
  throw new Error('PORT must be a positive integer.');
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parsedPort,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_URL: process.env.CLIENT_URL,
};
