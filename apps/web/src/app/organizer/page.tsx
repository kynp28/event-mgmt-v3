import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/api-server";

export default async function OrganizerDashboard() {
  const user = await getServerSession();
  
  if (!user || user.role !== "ORGANIZER") {
    redirect("/login");
  }

  // Redirect to events management
  redirect("/organizer/events");
}
