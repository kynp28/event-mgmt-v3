"use client";

import { apiClient } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function StatusActions({ eventId, currentStatus }: { eventId: string, currentStatus: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    try {
      setLoading(true);
      const res = await apiClient(`/api/organizer/events/${eventId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to change status");
      router.refresh();
    } catch (err) {
      alert("Error changing status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <span className="text-gray-600 font-medium">Status: {currentStatus}</span>
      <div className="flex gap-2">
        {currentStatus === "DRAFT" && (
          <button
            onClick={() => handleStatusChange("PUBLISHED")}
            disabled={loading}
            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
          >
            Publish
          </button>
        )}
        {currentStatus === "PUBLISHED" && (
          <>
            <button
              onClick={() => handleStatusChange("DRAFT")}
              disabled={loading}
              className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 disabled:opacity-50"
            >
              Unpublish
            </button>
            <button
              onClick={() => handleStatusChange("CLOSED")}
              disabled={loading}
              className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 disabled:opacity-50"
            >
              Close Event
            </button>
          </>
        )}
      </div>
    </div>
  );
}
