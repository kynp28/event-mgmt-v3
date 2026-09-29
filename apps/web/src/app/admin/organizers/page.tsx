"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export default function AdminOrganizersPage() {
  const [organizers, setOrganizers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrganizers = () => {
    setLoading(true);
    apiFetch("/api/admin/organizers/pending")
      .then(setOrganizers)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrganizers();
  }, []);

  const handleAction = async (id: string, status: "APPROVED" | "REJECTED") => {
    let reason = undefined;
    if (status === "REJECTED") {
      const p = prompt("Please enter a reason for rejection:");
      if (p === null) return; // user cancelled
      reason = p.trim();
      if (!reason) {
        alert("Reason is required to reject an organizer.");
        return;
      }
    }

    try {
      await apiFetch(`/api/admin/organizers/${id}/verify`, {
        method: "POST",
        body: JSON.stringify({ status, reason })
      });
      fetchOrganizers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Pending Organizers</h1>
      
      {loading ? (
        <p>Loading...</p>
      ) : organizers.length === 0 ? (
        <div className="bg-white p-6 text-center text-gray-500 rounded shadow">No pending organizers</div>
      ) : (
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 border-b">Company Name</th>
                <th className="p-4 border-b">Email</th>
                <th className="p-4 border-b">Applicant Name</th>
                <th className="p-4 border-b">Date Applied</th>
                <th className="p-4 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {organizers.map(org => (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="p-4 border-b font-semibold">{org.companyName}</td>
                  <td className="p-4 border-b">{org.user.email}</td>
                  <td className="p-4 border-b">{org.user.name || "-"}</td>
                  <td className="p-4 border-b">{new Date(org.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 border-b flex gap-2">
                    <button 
                      onClick={() => handleAction(org.id, "APPROVED")}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleAction(org.id, "REJECTED")}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
