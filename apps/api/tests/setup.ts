import { beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";

beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url || !url.includes("eventcore_test")) {
    console.error("CRITICAL: Test must run against eventcore_test database.");
    console.error(`Current DATABASE_URL: ${url}`);
    process.exit(1);
  }
});

afterAll(async () => {
  await db.$disconnect();
});
