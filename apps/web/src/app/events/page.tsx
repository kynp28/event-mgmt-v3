import Link from "next/link";
import { fetchServer } from "@/lib/api-server";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "งานจัดแสดงทั้งหมด",
};

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
      <h1 className="text-3xl font-bold mb-8">งานจัดแสดงทั้งหมด</h1>
      <div className="grid gap-6">
        {events.length === 0 ? (
          <p>ยังไม่มีงานจัดแสดงในขณะนี้</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="border rounded-lg p-6 flex flex-col gap-2 relative">
              {event.status !== "PUBLISHED" && (
                <span className="absolute top-4 right-4 bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded font-medium">
                  {event.status === "CLOSED" ? "ปิดรับจอง" : event.status}
                </span>
              )}
              <h2 className="text-2xl font-semibold pr-20">
                <Link href={`/events/${event.id}`} className="hover:underline">
                  {event.name}
                </Link>
              </h2>
              <p className="text-gray-600">{event.location}</p>
              <p className="text-sm">
                วันที่: {new Date(event.startDate).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })} -{" "}
                {new Date(event.endDate).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
