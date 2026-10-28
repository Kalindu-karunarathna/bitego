import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { B2BSuitability, PrismaClient } from "../src/generated/prisma/client";

// Run with: npm run db:seed -w @bitego/web
// Safe to run many times (upsert by name). It only creates the food categories.
//
// The admin user is NOT created here. A user's id must be the Supabase Auth user id,
// so create the admin by registering normally, then promote it (see the setup steps).

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DIRECT_URL or DATABASE_URL in apps/web/.env");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// b2bSuitability follows proposal section 6.6. These are starting values: the admin
// can change them later, and they will be refined after the stakeholder research.
const categories: { name: string; description: string; b2bSuitability: B2BSuitability }[] = [
  { name: "Bakery items", description: "Bread, buns, cakes, pastries", b2bSuitability: "SUITABLE" },
  { name: "Packaged food", description: "Unopened packaged products", b2bSuitability: "SUITABLE" },
  { name: "Packaged drinks", description: "Unopened bottled or packed drinks", b2bSuitability: "SUITABLE" },
  { name: "Raw ingredients", description: "Uncooked ingredients and produce", b2bSuitability: "SUITABLE" },
  { name: "Fruits & vegetables", description: "Fresh fruit and vegetables", b2bSuitability: "SUITABLE" },
  { name: "Prepared meals", description: "Cooked meals such as rice and curry", b2bSuitability: "RESTRICTED" },
  { name: "Short eats & snacks", description: "Cooked snacks and short eats", b2bSuitability: "RESTRICTED" },
  { name: "Desserts & sweets", description: "Desserts, sweets, ice cream", b2bSuitability: "RESTRICTED" },
  { name: "Other", description: "Anything that fits no other category", b2bSuitability: "RESTRICTED" },
];

async function main() {
  for (const c of categories) {
    await prisma.category.upsert({ where: { name: c.name }, update: {}, create: c });
  }
  console.log(`Seeded ${categories.length} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
