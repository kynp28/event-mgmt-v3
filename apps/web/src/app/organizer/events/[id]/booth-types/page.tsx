import { getServerSession, fetchServer } from "@/lib/api-server";
import { redirect } from "next/navigation";
import { BoothTypesManager } from "./BoothTypesManager";

export default async function BoothTypesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getServerSession();
  if (!user || user.role !== "ORGANIZER") {
    redirect("/login");
  }

  const { id } = await params;
  const res = await fetchServer(`/api/organizer/events/${id}/booth-types`, { cache: "no-store" });

  if (!res.ok) {
    redirect("/organizer/events");
  }

  const boothTypes = await res.json();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">จัดการประเภทบูธ</h2>
      <BoothTypesManager eventId={id} initialBoothTypes={boothTypes} />
    </div>
  );
}
