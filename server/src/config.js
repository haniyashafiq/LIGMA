const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: false });

const requiredVars = ["DATABASE_URL", "JWT_SECRET", "CLIENT_URL"];
const missingVars = requiredVars.filter((name) => !process.env[name]);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.join(", ")}`,
  );
}

const parsedPort = Number(process.env.PORT || 3000);

if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
  throw new Error("PORT must be a positive integer.");
}

function splitOrigins(value) {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function buildClientOrigins() {
  const origins = new Set([process.env.CLIENT_URL, ...splitOrigins(process.env.CLIENT_URLS)]);
  const baseUrl = process.env.CLIENT_URL;

  // In local dev, Vite may auto-shift from 5173 to 5174 when ports are busy.
  if (typeof baseUrl === "string" && /^https?:\/\/localhost(:\d+)?$/i.test(baseUrl.trim())) {
    origins.add("http://localhost:5173");
    origins.add("http://localhost:5174");
  }

  return Array.from(origins).filter(Boolean);
}

const CLIENT_ORIGINS = buildClientOrigins();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parsedPort,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_URL: process.env.CLIENT_URL,
  CLIENT_ORIGINS,
  DEBUG_SOCKET_LOGS: process.env.DEBUG_SOCKET_LOGS === "true",
};
