import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: {
      googleId: "test-google-user",
    },
    update: {},
    create: {
      googleId: "test-google-user",
      name: "Test User",
      email: "testuser@example.com",
      avatar: null,
    },
  });

  const sender = await prisma.sender.upsert({
    where: {
      email: "sender@example.com",
    },
    update: {},
    create: {
      email: "sender@example.com",
      name: "Test Sender",
      userId: user.id,
    },
  });

  console.log("Test user:", user);
  console.log("Test sender:", sender);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });