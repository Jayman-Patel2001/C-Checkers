import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clear all users, shifts, tasks, reviews
  await prisma.review.deleteMany({});
  await prisma.taskEventLog.deleteMany({});
  await prisma.taskEntry.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.taskAssignment.deleteMany({});
  await prisma.user.deleteMany({});

  // Create admin
  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin_CC@gmail.com",
      password: await bcrypt.hash("admin@CC_KP", 10),
      role: "ADMIN",
    },
  });
  console.log("Admin created:", admin.email);

  // Task definitions
  await prisma.taskDefinition.deleteMany({});

  const workTasks = [
    { name: "Fuel Pump Inspection", description: "Check all fuel pumps for proper operation and cleanliness", category: "WORK", sortOrder: 1 },
    { name: "Cashier / POS Duty", description: "Handle customer payments and transactions at the counter", category: "WORK", sortOrder: 2 },
    { name: "Convenience Store Restocking", description: "Restock shelves, coolers, and merchandise displays", category: "WORK", sortOrder: 3 },
    { name: "Lot Cleaning & Maintenance", description: "Sweep forecourt, empty trash bins, clean spills", category: "WORK", sortOrder: 4 },
    { name: "Restroom Cleaning", description: "Clean and sanitize customer restrooms", category: "WORK", sortOrder: 5 },
    { name: "Window Washing", description: "Clean store windows and fuel pump displays", category: "WORK", sortOrder: 6 },
    { name: "Oil & Fluid Check Assistance", description: "Help customers check oil, coolant, and tire pressure", category: "WORK", sortOrder: 7 },
    { name: "Inventory Count", description: "Count and record inventory for all store items", category: "WORK", sortOrder: 8 },
    { name: "Opening Duties", description: "Open registers, check fuel levels, unlock pumps", category: "WORK", sortOrder: 9 },
    { name: "Closing Duties", description: "Balance registers, secure premises, lock pumps", category: "WORK", sortOrder: 10 },
    { name: "Delivery & Receiving", description: "Receive deliveries and verify against purchase orders", category: "WORK", sortOrder: 11 },
    { name: "Car Wash Maintenance", description: "Inspect and maintain car wash equipment", category: "WORK", sortOrder: 12 },
  ];

  const personalTasks = [
    { name: "Lunch Break", description: "Scheduled lunch break", category: "PERSONAL", sortOrder: 1 },
    { name: "Short Break / Coffee", description: "Short rest break", category: "PERSONAL", sortOrder: 2 },
    { name: "Restroom Break", description: "Personal restroom use", category: "PERSONAL", sortOrder: 3 },
    { name: "Phone Call (Personal)", description: "Personal phone call", category: "PERSONAL", sortOrder: 4 },
    { name: "Training / Meeting", description: "Staff training session or team meeting", category: "PERSONAL", sortOrder: 5 },
  ];

  for (const task of [...workTasks, ...personalTasks]) {
    await prisma.taskDefinition.create({ data: task });
  }

  console.log(`Created ${workTasks.length + personalTasks.length} task definitions`);
  console.log("\nAdmin login: admin_CC@gmail.com / admin@CC_KP");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
