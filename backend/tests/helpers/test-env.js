const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { assertTestDatabase } = require("../../src/config/database-safety");

process.env.NODE_ENV = "test";

if (!process.env.DATABASE_URL_TEST) {
  const envPath = path.resolve(__dirname, "../../.env.test");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.test ausente. Execute npm run test:db:prepare.");
  }
  process.env.DATABASE_URL_TEST = dotenv.parse(
    fs.readFileSync(envPath),
  ).DATABASE_URL_TEST;
}

assertTestDatabase("Suite automatizada", process.env.DATABASE_URL_TEST);
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.SESSION_SECRET = "postfan-test-only-session-secret-32-chars";
process.env.GOOGLE_CLIENT_ID = "123456-postfan-test.apps.googleusercontent.com";
process.env.EMAIL_USER = "no-reply@postfan.invalid";
process.env.EMAIL_PASS = "test-only-password";
process.env.CLOUDINARY_CLOUD_NAME = "";
process.env.CLOUDINARY_API_KEY = "";
process.env.CLOUDINARY_API_SECRET = "";
