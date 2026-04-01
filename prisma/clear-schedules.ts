import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Order matters — delete dependents first
  await prisma.weeklyPaySummary.deleteMany();
  await prisma.wageOverride.deleteMany();
  await prisma.employeeSchedule.deleteMany();
  await prisma.weekSchedule.deleteMany();
  await prisma.employeePayRate.deleteMany();
  console.log("✓ All schedule data cleared. Shop hours and users untouched.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
