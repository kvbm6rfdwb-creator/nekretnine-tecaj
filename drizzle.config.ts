import type { Config } from "drizzle-kit";

const config: Config = {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./nekretnine.db"
  },
  verbose: true,
  strict: true
};

export default config;
