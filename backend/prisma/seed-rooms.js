const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

function randomCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
}

const myRoomNames = [
  "Vibez Only",
  "Late Night Chill",
  "Hip Hop Jams",
  "Lo-fi Study",
  "Throwback Anthems",
];

const joinedRoomNames = [
  "House Party",
  "Acoustic Sessions",
  "K-Pop Zone",
  "Indie Discovery",
  "EDM Energy",
  "R&B Vibes",
  "Rock Classics",
  "Jazz Lounge",
  "Workout Beats",
  "Road Trip Mix",
  "Coding Flow",
  "Sunset Grooves",
];

async function main() {
  // Find the user "Mj" (or first user)
  const user = await prisma.user.findFirst({ where: { name: { contains: "Mj" } } });
  if (!user) {
    console.log("No user 'Mj' found, trying first user...");
    const firstUser = await prisma.user.findFirst();
    if (!firstUser) { console.log("No users in DB. Please register first."); return; }
    console.log("Using user:", firstUser.name, firstUser.id);
    await seed(firstUser);
  } else {
    console.log("Using user:", user.name, user.id);
    await seed(user);
  }
}

async function seed(user) {
  // Create 5 rooms owned by user (My Rooms)
  for (const name of myRoomNames) {
    const existing = await prisma.room.findFirst({ where: { name, createdBy: user.id } });
    if (existing) { console.log(`  skip "${name}" (exists)`); continue; }

    const room = await prisma.room.create({
      data: {
        name,
        code: randomCode(),
        createdBy: user.id,
      },
    });
    // Also add as member
    await prisma.roomMember.create({
      data: { roomId: room.id, userId: user.id },
    });
    console.log(`  created MY room: "${name}" (${room.code})`);
  }

  // Create 12 rooms by a dummy "other user", then join the main user
  let otherUser = await prisma.user.findFirst({ where: { NOT: { id: user.id } } });
  if (!otherUser) {
    otherUser = await prisma.user.create({
      data: {
        name: "DJ Bot",
        email: "djbot@dropthetrack.dev",
        password: "$2b$10$fakehashforseeding000000000000000000000000000",
      },
    });
    console.log("  created dummy user: DJ Bot");
  }

  for (const name of joinedRoomNames) {
    const existing = await prisma.room.findFirst({ where: { name, createdBy: otherUser.id } });
    if (existing) {
      // Just make sure user is a member
      await prisma.roomMember.upsert({
        where: { roomId_userId: { roomId: existing.id, userId: user.id } },
        create: { roomId: existing.id, userId: user.id },
        update: {},
      });
      console.log(`  skip "${name}" (exists, ensured membership)`);
      continue;
    }

    const room = await prisma.room.create({
      data: {
        name,
        code: randomCode(),
        createdBy: otherUser.id,
      },
    });
    // Add other user as member
    await prisma.roomMember.create({
      data: { roomId: room.id, userId: otherUser.id },
    });
    // Add main user as member (so it shows in "Recently Joined")
    await prisma.roomMember.create({
      data: { roomId: room.id, userId: user.id },
    });
    console.log(`  created JOINED room: "${name}" (${room.code})`);
  }

  console.log("\nDone! Refresh the page.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
