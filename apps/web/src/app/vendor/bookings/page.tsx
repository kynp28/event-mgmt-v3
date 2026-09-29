"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export default function VendorBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    try {
      const data = await apiFetch("/api/vendor/bookings");
      setBookings(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    
    // Simple interval to re-render countdowns
    const interval = setInterval(() => {
      setBookings(prev => [...prev]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, bookingId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      return alert("File is too large. Max 2MB.");
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        await apiFetch(`/api/vendor/bookings/${bookingId}/payments`, {
          method: "POST",
          body: JSON.stringify({ slipImage: base64 })
        });
        alert("Slip uploaded successfully!");
        fetchBookings();
      } catch (err: any) {
        alert(err.message);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">My Bookings</h1>
      <div className="space-y-6">
        {bookings.map(booking => {
          const expiresAt = new Date(booking.holdExpiresAt);
          const now = new Date();
          const msLeft = expiresAt.getTime() - now.getTime();
          const mins = Math.max(0, Math.floor(msLeft / 60000));
          const secs = Math.max(0, Math.floor((msLeft % 60000) / 1000));
          const timeString = `${mins}:${secs.toString().padStart(2, '0')}`;
          
          return (
            <div key={booking.id} className="border p-6 rounded shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{booking.event?.name}</h3>
                  <p className="text-sm text-gray-500">Booking ID: {booking.id}</p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold 
                    ${booking.status === 'PAYMENT_PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      booking.status === 'PENDING_VERIFICATION' ? 'bg-blue-100 text-blue-800' :
                      booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'}`}>
                    {booking.status}
                  </span>
                  {booking.status === "PAYMENT_PENDING" && msLeft > 0 && (
                    <p className="text-red-500 font-bold mt-2 text-sm">Expires in: {timeString}</p>
                  )}
                  {booking.status === "PAYMENT_PENDING" && msLeft <= 0 && (
                    <p className="text-red-500 font-bold mt-2 text-sm">Expired</p>
                  )}
                  {booking.status === "CONFIRMED" && (
                    <div className="mt-2">
                      <a href={`/vendor/bookings/${booking.id}/ticket`} className="text-blue-600 underline font-semibold">View Ticket</a>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mb-4">
                <p className="font-semibold">Booths:</p>
                <div className="flex gap-2 mt-1">
                  {booking.items?.map((item: any) => (
                    <span key={item.id} className="bg-gray-100 px-2 py-1 rounded text-sm">{item.booth?.code}</span>
                  ))}
                </div>
                <p className="mt-2 font-bold">Total: ${booking.totalAmount}</p>
              </div>

              {booking.status === "PAYMENT_PENDING" && msLeft > 0 && (
                <div className="mt-4 border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload Payment Slip (Max 2MB)</label>
                  <input 
                    type="file" 
                    accept="image/jpeg, image/png, image/webp"
                    onChange={(e) => handleFileUpload(e, booking.id)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
              )}
              
              {booking.payments?.filter((p:any) => p.status === "REJECTED").map((p:any) => (
                <div key={p.id} className="mt-4 bg-red-50 p-3 rounded text-sm text-red-800">
                  <strong>Previous slip rejected:</strong> {p.rejectionReason}
                </div>
              ))}
            </div>
          );
        })}
        {bookings.length === 0 && <p>You have no bookings yet.</p>}
      </div>
    </div>
  );
}
