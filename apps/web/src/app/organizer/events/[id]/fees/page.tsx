import { getServerSession, fetchServer } from "@/lib/api-server";
import { redirect } from "next/navigation";
import { FeesManager } from "./FeesManager";

export default async function FeesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getServerSession();
  if (!user || user.role !== "ORGANIZER") {
    redirect("/login");
  }

  const { id } = await params;
  const res = await fetchServer(`/api/organizer/events/${id}/fees`, { cache: "no-store" });

  if (!res.ok) {
    redirect("/organizer/events");
  }

  const fees = await res.json();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">จัดการค่าธรรมเนียม</h2>
      <FeesManager eventId={id} initialFees={fees} />
    </div>
  );
}
