import { EventForm } from "@/components/EventForm";
import { getServerSession, fetchServer } from "@/lib/api-server";
import { redirect } from "next/navigation";
import { StatusActions } from "./StatusActions";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getServerSession();
  if (!user || user.role !== "ORGANIZER") {
    redirect("/login");
  }

  const { id } = await params;
  const res = await fetchServer(`/api/organizer/events/${id}`);
  
  if (!res.ok) {
    redirect("/organizer/events");
  }

  const event = await res.json();
  
  // Convert ISO dates to YYYY-MM-DD for the form defaults
  const initialData = {
    ...event,
    startDate: event.startDate.split("T")[0],
    endDate: event.endDate.split("T")[0],
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Manage Event</h1>
        <StatusActions eventId={event.id} currentStatus={event.status} />
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-6">Edit Details</h2>
        <EventForm eventId={event.id} initialData={initialData} />
      </div>
    </div>
  );
}
