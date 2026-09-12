import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    // The DIRECT Neon connection string. Migrations do not go through
    // Hyperdrive — that is a request-path concern only.
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
