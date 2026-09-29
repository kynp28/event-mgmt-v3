"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/api/admin/users").then(setUsers).catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">All Users</h1>
      
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-4 border-b">Email</th>
              <th className="p-4 border-b">Role</th>
              <th className="p-4 border-b">Name</th>
              <th className="p-4 border-b">Org Status</th>
              <th className="p-4 border-b">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="p-4 border-b">{u.email}</td>
                <td className="p-4 border-b">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                    u.role === 'ORGANIZER' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="p-4 border-b">{u.name || "-"}</td>
                <td className="p-4 border-b">
                  {u.organizerProfile ? (
                    <span className={`text-sm ${
                      u.organizerProfile.status === 'APPROVED' ? 'text-green-600' :
                      u.organizerProfile.status === 'REJECTED' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {u.organizerProfile.status}
                    </span>
                  ) : "-"}
                </td>
                <td className="p-4 border-b text-sm text-gray-500">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
