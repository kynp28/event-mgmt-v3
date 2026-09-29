"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export default function AdminEventsPage() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/api/admin/events").then(setEvents).catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">All Events</h1>
      
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-4 border-b">Event Name</th>
              <th className="p-4 border-b">Status</th>
              <th className="p-4 border-b">Organizer</th>
              <th className="p-4 border-b">Dates</th>
              <th className="p-4 border-b text-right">Booths</th>
            </tr>
          </thead>
          <tbody>
            {events.map(e => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="p-4 border-b font-semibold">{e.name}</td>
                <td className="p-4 border-b">
                  <span className={`px-2 py-1 text-xs rounded font-bold ${
                    e.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
                    e.status === 'CLOSED' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {e.status}
                  </span>
                </td>
                <td className="p-4 border-b text-sm">
                  <div>{e.organizer.name || "-"}</div>
                  <div className="text-gray-500">{e.organizer.email}</div>
                </td>
                <td className="p-4 border-b text-sm text-gray-600">
                  {new Date(e.startDate).toLocaleDateString()} - {new Date(e.endDate).toLocaleDateString()}
                </td>
                <td className="p-4 border-b text-right font-mono">{e._count.booths}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
