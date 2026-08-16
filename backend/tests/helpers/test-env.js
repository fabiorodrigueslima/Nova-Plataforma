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
process.env.JWT_SECRET = "postfan-test-only-jwt-secret";
process.env.CLOUDINARY_CLOUD_NAME = "";
process.env.CLOUDINARY_API_KEY = "";
process.env.CLOUDINARY_API_SECRET = "";
