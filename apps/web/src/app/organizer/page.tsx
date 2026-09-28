import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/api-server";
import { LogoutButton } from "@/components/LogoutButton";

export default async function OrganizerDashboard() {
  const user = await getServerSession();
  
  if (!user || user.role !== "ORGANIZER") {
    redirect("/login");
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Organizer Dashboard</h1>
      <p>Welcome, {user.name} ({user.role})</p>
      <LogoutButton />
    </div>
  );
}
