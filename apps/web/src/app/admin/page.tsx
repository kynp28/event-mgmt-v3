"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    apiFetch("/api/admin/overview").then(setStats).catch(console.error);
  }, []);

  if (!stats) return <div>Loading dashboard...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded shadow border-t-4 border-blue-500">
          <h2 className="text-xl font-bold mb-4">Users by Role</h2>
          <ul>
            {stats.userCounts.map((u: any) => (
              <li key={u.role} className="flex justify-between border-b py-2">
                <span>{u.role}</span>
                <span className="font-bold">{u._count}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="bg-white p-6 rounded shadow border-t-4 border-green-500">
          <h2 className="text-xl font-bold mb-4">Events by Status</h2>
          <ul>
            {stats.eventCounts.map((e: any) => (
              <li key={e.status} className="flex justify-between border-b py-2">
                <span>{e.status}</span>
                <span className="font-bold">{e._count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-6 rounded shadow border-t-4 border-purple-500">
          <h2 className="text-xl font-bold mb-4">Bookings by Status</h2>
          <ul>
            {stats.bookingCounts.map((b: any) => (
              <li key={b.status} className="flex justify-between border-b py-2">
                <span>{b.status}</span>
                <span className="font-bold">{b._count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
