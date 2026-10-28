import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma CLI settings (Prisma 7). DIRECT_URL is the direct (non-pooled) connection
// string, used for migrations. The app itself uses DATABASE_URL (see src/lib/prisma.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `prisma generate` needs a URL to be defined but never connects, so CI can use this
    // placeholder. Real commands (migrate, studio, seed) use the DIRECT_URL from .env.
    url: process.env.DIRECT_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
