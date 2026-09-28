import { notFound } from "next/navigation";
import { fetchServer } from "@/lib/api-server";

export default async function PublicEventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetchServer(`/api/events/${id}`);
  
  if (!res.ok) {
    if (res.status === 404) notFound();
    throw new Error("Failed to load event");
  }

  const event = await res.json();

  return (
    <div className="max-w-4xl mx-auto p-8">
      {event.coverImage && (
        <img src={event.coverImage} alt={event.name} className="w-full h-64 object-cover rounded-lg mb-8" />
      )}
      <h1 className="text-4xl font-bold mb-4">{event.name}</h1>
      <p className="text-xl text-gray-600 mb-6">{event.location}</p>
      
      <div className="bg-gray-50 p-6 rounded-lg mb-8">
        <p className="font-semibold">
          Date: {new Date(event.startDate).toLocaleDateString("en-US", { timeZone: "Asia/Bangkok" })} -{" "}
          {new Date(event.endDate).toLocaleDateString("en-US", { timeZone: "Asia/Bangkok" })}
        </p>
      </div>

      {event.description && (
        <div className="prose max-w-none">
          <p className="whitespace-pre-wrap">{event.description}</p>
        </div>
      )}
    </div>
  );
}
