"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useParams, useRouter } from "next/navigation";

export default function VendorEventPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [event, setEvent] = useState<any>(null);
  const [booths, setBooths] = useState<any[]>([]);
  const [selectedBooths, setSelectedBooths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/events/${id}`),
      apiFetch(`/api/events/${id}/booths`)
    ]).then(([evt, bths]) => {
      setEvent(evt);
      setBooths(bths.filter((b: any) => b.status === "AVAILABLE"));
      setLoading(false);
    }).catch(err => {
      alert(err.message);
      setLoading(false);
    });
  }, [id]);

  const toggleBooth = (boothId: string) => {
    setSelectedBooths(prev => 
      prev.includes(boothId) ? prev.filter(b => b !== boothId) : [...prev, boothId]
    );
  };

  const handleCheckout = async () => {
    if (selectedBooths.length === 0) return alert("Select at least one booth");
    try {
      await apiFetch("/api/vendor/bookings", {
        method: "POST",
        body: JSON.stringify({ eventId: id, boothIds: selectedBooths })
      });
      alert("Booking created successfully!");
      router.push("/vendor/bookings");
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!event) return <div>Event not found</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">{event.name}</h1>
      <p className="text-gray-600 mb-6">{event.location} | Max Booths Per Vendor: {event.maxBoothsPerVendor}</p>
      
      <h2 className="text-xl font-bold mb-4">Available Booths</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {booths.map(booth => (
          <div key={booth.id} className="border p-4 rounded flex items-center justify-between">
            <div>
              <p className="font-bold">{booth.code}</p>
              <p className="text-sm">${booth.price}</p>
            </div>
            <input 
              type="checkbox" 
              checked={selectedBooths.includes(booth.id)}
              onChange={() => toggleBooth(booth.id)}
              className="w-5 h-5"
            />
          </div>
        ))}
        {booths.length === 0 && <p>No booths available right now.</p>}
      </div>

      <button 
        onClick={handleCheckout}
        disabled={selectedBooths.length === 0}
        className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50"
      >
        Checkout Selected ({selectedBooths.length})
      </button>
    </div>
  );
}
