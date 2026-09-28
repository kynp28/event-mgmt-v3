import Link from "next/link";
import { fetchServer, getServerSession } from "@/lib/api-server";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";

export default async function OrganizerEventsPage() {
  const user = await getServerSession();
  if (!user || user.role !== "ORGANIZER") {
    redirect("/login");
  }

  const events = await fetchServer("/api/organizer/events").then((r) => r.json());

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Events</h1>
        <div className="flex gap-4">
          <Link
            href="/organizer/events/create"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create Event
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">Date</th>
              <th className="p-4">Location</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  No events found.
                </td>
              </tr>
            ) : (
              events.map((event: any) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium">{event.name}</td>
                  <td className="p-4 text-sm text-gray-600">
                    {new Date(event.startDate).toLocaleDateString("en-US", { timeZone: "Asia/Bangkok" })}
                  </td>
                  <td className="p-4 text-sm text-gray-600">{event.location}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-semibold ${
                        event.status === "PUBLISHED"
                          ? "bg-green-100 text-green-800"
                          : event.status === "DRAFT"
                          ? "bg-gray-100 text-gray-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {event.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/organizer/events/${event.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
