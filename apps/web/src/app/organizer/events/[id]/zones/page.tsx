import { getServerSession, fetchServer } from "@/lib/api-server";
import { redirect } from "next/navigation";
import { ZonesManager } from "./ZonesManager";

export default async function ZonesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getServerSession();
  if (!user || user.role !== "ORGANIZER") {
    redirect("/login");
  }

  const { id } = await params;
  const res = await fetchServer(`/api/organizer/events/${id}/zones`, { cache: "no-store" });
  
  if (!res.ok) {
    redirect("/organizer/events");
  }

  const zones = await res.json();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Manage Zones</h2>
      <ZonesManager eventId={id} initialZones={zones} />
    </div>
  );
}
