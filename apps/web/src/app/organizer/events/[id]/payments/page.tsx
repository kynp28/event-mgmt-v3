"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useParams } from "next/navigation";

export default function OrganizerPaymentsPage() {
  const { id } = useParams() as { id: string };
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    try {
      const data = await apiFetch(`/api/organizer/events/${id}/payments`);
      setPayments(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [id]);

  const handleVerify = async (paymentId: string, status: "APPROVED" | "REJECTED") => {
    let rejectionReason = undefined;
    if (status === "REJECTED") {
      rejectionReason = prompt("Please provide a reason for rejection:");
      if (!rejectionReason) return;
    }

    try {
      await apiFetch(`/api/organizer/payments/${paymentId}/verify`, {
        method: "POST",
        body: JSON.stringify({ status, rejectionReason })
      });
      alert(`Payment ${status.toLowerCase()} successfully!`);
      fetchPayments();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Pending Payments</h1>
      
      <div className="space-y-6">
        {payments.map(payment => (
          <div key={payment.id} className="border p-6 rounded flex flex-col md:flex-row gap-6 shadow-sm bg-white">
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-2">Vendor: {payment.booking?.vendor?.name} ({payment.booking?.vendor?.email})</h3>
              <p className="text-sm text-gray-500 mb-1">Booking ID: {payment.bookingId}</p>
              <p className="font-semibold mb-2">Amount: ${payment.amount}</p>
              
              <div className="mb-4">
                <p className="text-sm font-semibold">Booths:</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {payment.booking?.items?.map((item: any) => (
                    <span key={item.id} className="bg-gray-100 px-2 py-1 rounded text-xs">{item.booth?.code}</span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Status:</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold
                  ${payment.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    payment.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'}`}>
                  {payment.status}
                </span>
              </div>
              
              {payment.status === 'REJECTED' && (
                <p className="mt-2 text-sm text-red-600">Reason: {payment.rejectionReason}</p>
              )}
            </div>

            <div className="w-full md:w-1/3">
              <p className="text-sm font-semibold mb-2">Slip Image:</p>
              {payment.slipImage ? (
                <img src={payment.slipImage} alt="Payment Slip" className="max-w-full h-auto max-h-48 object-contain border rounded" />
              ) : (
                <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-gray-400 text-sm border rounded">No Slip</div>
              )}
              
              {payment.status === "PENDING" && (
                <div className="flex gap-2 mt-4">
                  <button 
                    onClick={() => handleVerify(payment.id, "APPROVED")}
                    className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleVerify(payment.id, "REJECTED")}
                    className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {payments.length === 0 && <p className="text-gray-500">No payments found.</p>}
      </div>
    </div>
  );
}
