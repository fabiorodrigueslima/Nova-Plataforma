const path = require("path");
const { spawnSync } = require("child_process");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});

const {
  assertLocalDevelopmentDatabase,
} = require("../src/config/database-safety");

assertLocalDevelopmentDatabase("Prisma migrate dev");

const prismaExecutable = path.resolve(
  __dirname,
  `../node_modules/.bin/prisma${process.platform === "win32" ? ".cmd" : ""}`,
);
const result = spawnSync(prismaExecutable, ["migrate", "dev", ...process.argv.slice(2)], {
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
