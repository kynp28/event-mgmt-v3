import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/api-server";
import { LogoutButton } from "@/components/LogoutButton";

export default async function AdminDashboard() {
  const user = await getServerSession();
  
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p>Welcome, {user.name} ({user.role})</p>
      <LogoutButton />
    </div>
  );
}
