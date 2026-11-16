import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!
  })
});

async function main() {
  const listings = await prisma.foodListing.findMany({
    select: {
      title: true,
      status: true,
      quantityAvailable: true,
      pickupEnd: true,
      audience: true,
      business: { select: { name: true, status: true } },
      category: { select: { name: true, isActive: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  console.log("TOTAL LISTINGS:", await prisma.foodListing.count());

  console.table(listings.map(item => ({
    title: item.title,
    status: item.status,
    quantity: item.quantityAvailable,
    pickupEnd: item.pickupEnd.toISOString(),
    audience: item.audience,
    business: item.business.name,
    businessStatus: item.business.status,
    category: item.category.name,
    categoryActive: item.category.isActive
  })));
}

main()
  .catch(error => {
    console.error("CHECK FAILED:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
