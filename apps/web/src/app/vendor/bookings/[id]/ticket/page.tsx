"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

export default function VendorTicketPage() {
  const { id } = useParams() as { id: string };
  const [ticketInfo, setTicketInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/api/vendor/bookings/${id}/ticket`)
      .then(data => {
        setTicketInfo(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600 font-bold">Error: {error}</div>;
  if (!ticketInfo) return <div className="p-8">Ticket not found</div>;

  return (
    <div className="p-8 max-w-lg mx-auto text-center border mt-8 rounded shadow bg-white">
      <h1 className="text-3xl font-bold mb-2">E-Ticket</h1>
      <h2 className="text-xl text-gray-700 mb-6">{ticketInfo.event?.name}</h2>
      
      <div className="flex justify-center mb-6">
        <QRCodeSVG 
          value={ticketInfo.ticket?.token} 
          size={256}
          level="H"
        />
      </div>
      
      <p className="text-sm text-gray-500 mb-4">Show this QR code at the event check-in desk.</p>
      
      <div className="text-left bg-gray-50 p-4 rounded border">
        <p className="font-semibold mb-2">Booking ID: <span className="font-normal text-gray-700">{ticketInfo.id}</span></p>
        <p className="font-semibold mb-2">Booths:</p>
        <div className="flex gap-2 flex-wrap mb-4">
          {ticketInfo.items?.map((item: any) => (
            <span key={item.id} className="bg-blue-100 text-blue-800 px-3 py-1 rounded font-bold">
              {item.booth?.code}
            </span>
          ))}
        </div>
        <p className="font-semibold">Checked In: <span className="font-normal">{ticketInfo.ticket?.checkedInAt ? new Date(ticketInfo.ticket.checkedInAt).toLocaleString() : "Not yet"}</span></p>
      </div>
    </div>
  );
}
