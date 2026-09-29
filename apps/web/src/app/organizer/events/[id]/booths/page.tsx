import { getServerSession, fetchServer } from "@/lib/api-server";
import { redirect } from "next/navigation";
import { BoothsManager } from "./BoothsManager";

export default async function BoothsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getServerSession();
  if (!user || user.role !== "ORGANIZER") {
    redirect("/login");
  }

  const { id } = await params;
  const [boothsRes, zonesRes] = await Promise.all([
    fetchServer(`/api/organizer/events/${id}/booths`, { cache: "no-store" }),
    fetchServer(`/api/organizer/events/${id}/zones`, { cache: "no-store" })
  ]);
  
  if (!boothsRes.ok || !zonesRes.ok) {
    redirect("/organizer/events");
  }

  const booths = await boothsRes.json();
  const zones = await zonesRes.json();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Manage Booths</h2>
      <BoothsManager eventId={id} initialBooths={booths} zones={zones} />
    </div>
  );
}
