import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { B2BSuitability, PrismaClient, type Role } from "../src/generated/prisma/client";

// Run with: npm run db:seed -w @bitego/web
// Safe to run many times. It creates:
//   1. the food categories (always)
//   2. the admin account, if SEED_ADMIN_PASSWORD is set in apps/web/.env
//   3. demo accounts, 2 demo businesses and some listings, if SEED_DEMO_PASSWORD is set
// Passwords come ONLY from your local .env (never commit them). Running again resets the demo
// pickup times so the demo listings are available again, and applies a changed password.

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DIRECT_URL or DATABASE_URL in apps/web/.env");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// ---------- 1. categories ----------
// b2bSuitability follows proposal section 6.6. The admin can change them later.
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

// ---------- helpers ----------
function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/web/.env");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Returns the Supabase Auth user id for this email. Creates the login if it does not exist,
// otherwise sets the password again (so changing the password in .env and re-running works).
async function ensureAuthUser(email: string, password: string, fullName: string): Promise<string> {
  const admin = supabaseAdmin();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (created.data.user) return created.data.user.id;
  if (created.error?.code !== "email_exists") throw created.error ?? new Error(`Could not create ${email}`);

  for (let page = 1; page <= 20; page++) {
    const list = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (list.error) throw list.error;
    const found = list.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      const updated = await admin.auth.admin.updateUserById(found.id, { password });
      if (updated.error) throw updated.error;
      return found.id;
    }
    if (list.data.users.length < 200) break;
  }
  throw new Error(`${email} exists in Supabase but could not be found`);
}

async function ensureUser(email: string, password: string, fullName: string, role: Role) {
  const id = await ensureAuthUser(email, password, fullName);
  return prisma.user.upsert({
    where: { id },
    update: { role, fullName, status: "ACTIVE" },
    create: { id, email, fullName, role },
  });
}

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000);

// ---------- 3. demo data ----------
async function seedDemo(password: string) {
  const cat = async (name: string) => (await prisma.category.findUniqueOrThrow({ where: { name } })).id;

  await ensureUser("demo.customer@bitego.test", password, "Demo Customer", "CUSTOMER");

  const businesses = [
    {
      email: "demo.bakery@bitego.test",
      owner: "Demo Bakery Owner",
      name: "Demo Bakery",
      type: "BAKERY" as const,
      contactNo: "0112345678",
      addressLine: "1 Main Street, Fort",
      city: "Colombo",
      district: "Colombo",
      latitude: 6.9344,
      longitude: 79.8428,
      listings: [
        { title: "Mixed bread bundle", category: "Bakery items", qty: 10, unit: "PACK" as const, orig: 900, price: 450, audience: "EVERYONE" as const, from: 1, to: 5 },
        { title: "Chocolate cake slices", category: "Desserts & sweets", qty: 8, unit: "PIECE" as const, orig: 400, price: 200, audience: "CUSTOMERS_ONLY" as const, from: 1, to: 4 },
        { title: "Flour and sugar (bulk)", category: "Raw ingredients", qty: 5, unit: "KG" as const, orig: 1200, price: 600, audience: "BUSINESSES_ONLY" as const, from: 1, to: 8 },
      ],
    },
    {
      email: "demo.cafe@bitego.test",
      owner: "Demo Cafe Owner",
      name: "Demo Cafe",
      type: "CAFE" as const,
      contactNo: "0812345678",
      addressLine: "5 Temple Road",
      city: "Kandy",
      district: "Kandy",
      latitude: 7.2906,
      longitude: 80.6337,
      listings: [
        { title: "Rice and curry packs", category: "Prepared meals", qty: 12, unit: "PORTION" as const, orig: 600, price: 300, audience: "EVERYONE" as const, from: 1, to: 3 },
      ],
    },
  ];

  for (const b of businesses) {
    const owner = await ensureUser(b.email, password, b.owner, "BUSINESS");
    const business = await prisma.business.upsert({
      where: { ownerId: owner.id },
      update: { status: "ACTIVE" },
      create: {
        ownerId: owner.id,
        name: b.name,
        type: b.type,
        description: `${b.name} (demo data)`,
        contactNo: b.contactNo,
        addressLine: b.addressLine,
        city: b.city,
        district: b.district,
        latitude: b.latitude,
        longitude: b.longitude,
        status: "ACTIVE",
      },
    });
    for (const l of b.listings) {
      const times = { pickupStart: hoursFromNow(l.from), pickupEnd: hoursFromNow(l.to) };
      const existing = await prisma.foodListing.findFirst({ where: { businessId: business.id, title: l.title } });
      if (existing) {
        await prisma.foodListing.update({ where: { id: existing.id }, data: times });
      } else {
        await prisma.foodListing.create({
          data: {
            businessId: business.id,
            categoryId: await cat(l.category),
            title: l.title,
            description: "Demo listing",
            quantityTotal: l.qty,
            quantityAvailable: l.qty,
            unit: l.unit,
            originalPrice: l.orig,
            price: l.price,
            audience: l.audience,
            ...times,
          },
        });
      }
    }
  }
  console.log("Seeded demo accounts, 2 businesses and listings (password = SEED_DEMO_PASSWORD).");
}

async function main() {
  for (const c of categories) {
    await prisma.category.upsert({ where: { name: c.name }, update: {}, create: c });
  }
  console.log(`Seeded ${categories.length} categories.`);

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminPassword) {
    await ensureUser("admin@bitego.test", adminPassword, "BiteGo Admin", "ADMIN");
    console.log("Admin ready: admin@bitego.test");
  } else {
    console.log("SEED_ADMIN_PASSWORD not set: admin account skipped.");
  }

  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  if (demoPassword) {
    await seedDemo(demoPassword);
  } else {
    console.log("SEED_DEMO_PASSWORD not set: demo data skipped.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
