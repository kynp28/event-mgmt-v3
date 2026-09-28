import { EventForm } from "@/components/EventForm";
import { getServerSession } from "@/lib/api-server";
import { redirect } from "next/navigation";

export default async function CreateEventPage() {
  const user = await getServerSession();
  if (!user || user.role !== "ORGANIZER") {
    redirect("/login");
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Create Event</h1>
      <div className="bg-white p-6 rounded shadow">
        <EventForm />
      </div>
    </div>
  );
}
