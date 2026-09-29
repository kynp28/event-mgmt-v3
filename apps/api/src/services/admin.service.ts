import { db } from "../lib/db";
import { AppError } from "../utils/AppError";
import { VerifyOrganizerPayload } from "@eventcore/shared";

export async function getPendingOrganizers() {
  return await db.organizerProfile.findMany({
    where: { status: "PENDING" },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: "asc" }
  });
}

export async function verifyOrganizer(profileId: string, data: VerifyOrganizerPayload, adminId: string) {
  const profile = await db.organizerProfile.findUnique({
    where: { id: profileId }
  });

  if (!profile) throw new AppError(404, "NOT_FOUND", "Organizer profile not found");
  if (profile.status === data.status) {
    if (data.status === "APPROVED") return { message: "Already approved" };
    if (data.status === "REJECTED") return { message: "Already rejected" };
  }

  if (profile.status === "APPROVED" && data.status === "REJECTED") {
    throw new AppError(400, "INVALID_TRANSITION", "Cannot reject an already approved organizer");
  }

  await db.$transaction(async (tx) => {
    await tx.organizerProfile.update({
      where: { id: profileId },
      data: { status: data.status }
    });

    if (data.status === "REJECTED") {
      await tx.auditLog.create({
        data: {
          action: "REJECTED",
          entityType: "OrganizerProfile",
          entityId: profileId,
          userId: adminId,
          metadata: { reason: data.reason }
        }
      });
    }
  });

  return { message: `Organizer ${data.status.toLowerCase()} successfully` };
}

export async function getAllUsers() {
  return await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      organizerProfile: { select: { status: true, companyName: true } },
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getAllEvents() {
  return await db.event.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      organizer: { select: { email: true, name: true } },
      _count: { select: { booths: true } }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getOverviewStats() {
  const [userCounts, eventCounts, bookingCounts] = await Promise.all([
    db.user.groupBy({ by: ["role"], _count: true }),
    db.event.groupBy({ by: ["status"], _count: true }),
    db.booking.groupBy({ by: ["status"], _count: true })
  ]);

  return { userCounts, eventCounts, bookingCounts };
}
