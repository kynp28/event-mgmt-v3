import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

export async function clearDb() {
  if (!process.env.DATABASE_URL?.includes("eventcore_test")) {
    throw new Error("clearDb can only be run on eventcore_test database");
  }
  await db.$transaction([
    db.ticket.deleteMany(),
    db.payment.deleteMany(),
    db.bookingItem.deleteMany(),
    db.booking.deleteMany(),
    db.booth.deleteMany(),
    db.boothType.deleteMany(),
    db.eventFee.deleteMany(),
    db.zone.deleteMany(),
    db.event.deleteMany(),
    db.auditLog.deleteMany(),
    db.organizerProfile.deleteMany(),
    db.vendorProfile.deleteMany(),
    db.user.deleteMany()
  ]);
}

export async function createTestUsers() {
  const password = await bcrypt.hash("password123", 10);
  
  const admin = await db.user.create({
    data: { email: "admin@test.com", password, role: "ADMIN" }
  });

  const org = await db.user.create({
    data: { 
      email: "org@test.com", password, role: "ORGANIZER",
      organizerProfile: {
        create: { companyName: "Test Org", status: "APPROVED" }
      }
    }
  });

  const vendor = await db.user.create({
    data: { email: "vendor@test.com", password, role: "VENDOR" }
  });

  return { admin, org, vendor };
}

export async function createTestEvent(orgId: string, maxBooths = 2) {
  return db.event.create({
    data: {
      name: "Test Event",
      location: "Test Location",
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      status: "PUBLISHED",
      maxBoothsPerVendor: maxBooths,
      organizerId: orgId
    }
  });
}
