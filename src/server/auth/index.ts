import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export async function requireRole(allowedRoles: Role[]) {
  const user = await requireUser();
  if (!allowedRoles.includes(user.role as Role)) {
    throw new Error("Forbidden");
  }
  return user;
}

export async function requireOrganizerEventOwnership(eventId: string) {
  const user = await requireRole(["ORGANIZER", "ADMIN"]);
  
  if (user.role === "ADMIN") {
    return user; // Admins can access any event
  }

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true }
  });

  if (!event || event.organizerId !== user.id) {
    throw new Error("Forbidden: You do not own this event");
  }

  return user;
}
