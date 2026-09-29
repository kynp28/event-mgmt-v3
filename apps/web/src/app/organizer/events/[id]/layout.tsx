import { getServerSession, fetchServer } from "@/lib/api-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { StatusActions } from "./StatusActions";

export default async function EventManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
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

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/organizer/events" className="text-blue-600 hover:underline mb-2 inline-block">
            &larr; Back to Events
          </Link>
          <h1 className="text-3xl font-bold">{event.name}</h1>
        </div>
        <StatusActions eventId={event.id} currentStatus={event.status} />
      </div>

      <div className="flex space-x-6 border-b border-gray-200 mb-8 pb-2">
        <Link href={`/organizer/events/${id}`} className="font-medium text-gray-600 hover:text-black">
          Details
        </Link>
        <Link href={`/organizer/events/${id}/zones`} className="font-medium text-gray-600 hover:text-black">
          Zones
        </Link>
        <Link href={`/organizer/events/${id}/booths`} className="font-medium text-gray-600 hover:text-black">
          Booths
        </Link>
        <Link href={`/organizer/events/${id}/payments`} className="font-medium text-gray-600 hover:text-black">
          Payments
        </Link>
        <Link href={`/organizer/events/${id}/checkin`} className="font-medium text-gray-600 hover:text-black">
          Check-in
        </Link>
      </div>

      <div>{children}</div>
    </div>
  );
}
