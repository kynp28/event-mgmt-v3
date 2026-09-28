import Link from "next/link";
import { fetchServer } from "@/lib/api-server";

// We use the same DTO signature that API returns
type PublicEvent = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  maxBoothsPerVendor: number;
  status: string;
};

export default async function PublicEventsPage() {
  const events: PublicEvent[] = await fetchServer("/api/events")
    .then((r) => r.json())
    .catch(() => []);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Upcoming Events</h1>
      <div className="grid gap-6">
        {events.length === 0 ? (
          <p>No events published yet.</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="border rounded-lg p-6 flex flex-col gap-2">
              <h2 className="text-2xl font-semibold">
                <Link href={`/events/${event.id}`} className="hover:underline">
                  {event.name}
                </Link>
              </h2>
              <p className="text-gray-600">{event.location}</p>
              <p className="text-sm">
                {new Date(event.startDate).toLocaleDateString("en-US", { timeZone: "Asia/Bangkok" })} -{" "}
                {new Date(event.endDate).toLocaleDateString("en-US", { timeZone: "Asia/Bangkok" })}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
