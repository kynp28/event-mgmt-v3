"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useParams } from "next/navigation";

export default function OrganizerCheckinPage() {
  const { id } = useParams() as { id: string };
  const [token, setToken] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    
    setLoading(true);
    setError("");
    setResult(null);
    
    try {
      const data = await apiFetch(`/api/organizer/events/${id}/checkin`, {
        method: "POST",
        body: JSON.stringify({ token: token.trim() })
      });
      setResult(data);
      setToken(""); // clear for next scan
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-xl mx-auto mt-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Manual QR Check-in</h1>
      
      <form onSubmit={handleCheckIn} className="flex gap-4 mb-8">
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter ticket token string"
          className="flex-1 border p-3 rounded text-lg"
          autoFocus
        />
        <button 
          type="submit" 
          disabled={loading || !token.trim()}
          className="bg-blue-600 text-white px-6 py-3 rounded font-bold disabled:opacity-50"
        >
          {loading ? "..." : "Check In"}
        </button>
      </form>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-4">
          <p className="font-bold text-lg">Error</p>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-green-100 border border-green-400 text-green-800 p-6 rounded text-center">
          <p className="text-2xl font-black mb-2">Check-in Successful!</p>
          <p className="text-lg mb-1">Vendor: <strong>{result.vendorName}</strong> ({result.vendorEmail})</p>
          <p className="text-lg">Booths: <strong>{result.booths}</strong></p>
        </div>
      )}
    </div>
  );
}
