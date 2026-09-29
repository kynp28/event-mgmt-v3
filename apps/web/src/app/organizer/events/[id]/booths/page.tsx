import { getServerSession, fetchServer } from "@/lib/api-server";
import { redirect } from "next/navigation";
import { BoothsManager } from "./BoothsManager";

export default async function BoothsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getServerSession();
  if (!user || user.role !== "ORGANIZER") {
    redirect("/login");
  }

  const { id } = await params;
  const [eventRes, boothsRes, zonesRes] = await Promise.all([
    fetchServer(`/api/organizer/events/${id}`, { cache: "no-store" }),
    fetchServer(`/api/organizer/events/${id}/booths`, { cache: "no-store" }),
    fetchServer(`/api/organizer/events/${id}/zones`, { cache: "no-store" })
  ]);
  
  if (!eventRes.ok || !boothsRes.ok || !zonesRes.ok) {
    redirect("/organizer/events");
  }

  const event = await eventRes.json();
  const booths = await boothsRes.json();
  const zones = await zonesRes.json();

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <h2 className="text-xl font-semibold mb-4">Manage Booths</h2>
      <BoothsManager event={event} initialBooths={booths} zones={zones} />
    </div>
  );
}
