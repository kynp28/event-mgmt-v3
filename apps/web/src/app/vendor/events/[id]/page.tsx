"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const FloorplanCanvas = dynamic(() => import("@/components/FloorplanCanvas"), { ssr: false });

import { LogoutButton } from "@/components/LogoutButton";
import Link from "next/link";
import { formatMoney, formatSatang, multiplySatang, sumSatang } from "@/lib/money";

interface EventFee {
  name: string;
  type: "PER_BOOKING" | "PER_BOOTH";
  amount: string;
}

export default function VendorEventPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [event, setEvent] = useState<any>(null);
  const [booths, setBooths] = useState<any[]>([]);
  const [fees, setFees] = useState<EventFee[]>([]);
  const [feesError, setFeesError] = useState(false);
  const [selectedBooths, setSelectedBooths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"MAP" | "LIST">("MAP");

  useEffect(() => {
    apiFetch(`/api/events/${id}`).then(async (evt) => {
      setEvent(evt);
      if (evt.status === "PUBLISHED") {
        const [bths, feesData] = await Promise.all([
          apiFetch(`/api/events/${id}/booths`),
          apiFetch(`/api/events/${id}/fees`).catch(() => {
            setFeesError(true);
            return [];
          })
        ]);
        setBooths(bths);
        setFees(feesData);
      }
      setLoading(false);
    }).catch(err => {
      alert(err.message);
      setLoading(false);
    });
  }, [id]);

  const toggleBooth = (boothId: string) => {
    const booth = booths.find(b => b.id === boothId);
    if (!booth || booth.status !== "AVAILABLE") return;

    setSelectedBooths(prev => {
      if (prev.includes(boothId)) return prev.filter(b => b !== boothId);
      if (prev.length >= (event?.maxBoothsPerVendor || 1)) {
        alert(`You can only select up to ${event?.maxBoothsPerVendor} booth(s).`);
        return prev;
      }
      return [...prev, boothId];
    });
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

  if (loading) return <div className="p-8">Loading...</div>;
  if (!event) return <div className="p-8">Event not found</div>;

  if (event.status !== "PUBLISHED") {
    return (
      <div className="p-8 max-w-5xl mx-auto flex flex-col h-[calc(100vh-64px)]">
        <div className="flex justify-between items-center mb-4">
          <div>
            <Link href="/vendor" className="text-blue-600 hover:underline mb-2 inline-block">
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold mb-2">{event.name}</h1>
          </div>
          <LogoutButton />
        </div>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-lg text-center mt-8">
          <p className="text-xl font-bold">ปิดรับจองสำหรับงานนี้</p>
        </div>
      </div>
    );
  }

  const selectedBoothItems = selectedBooths
    .map((bId) => booths.find((x) => x.id === bId))
    .filter((b): b is NonNullable<typeof b> => b != null);

  const boothSubtotalSatang = sumSatang(selectedBoothItems.map((b) => b.price));

  const feeCalculations = fees.map((f) => {
    const qty = f.type === "PER_BOOKING" ? 1 : selectedBooths.length;
    const subtotalSatang = multiplySatang(f.amount, qty);
    return {
      fee: f,
      qty,
      subtotalSatang,
    };
  });

  const totalFeesSatang = sumSatang(feeCalculations.map((fc) => fc.subtotalSatang));
  const grandTotalSatang = selectedBooths.length > 0 ? (boothSubtotalSatang + totalFeesSatang) : BigInt(0);

  const selectedCodes = selectedBooths.map(bId => booths.find(x => x.id === bId)?.code).join(", ");
  
  const unplacedBooths = booths.filter(b => b.x === null || b.y === null);
  const availableBooths = booths.filter(b => b.status === "AVAILABLE");

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col h-[calc(100vh-64px)]">
      <div className="flex justify-between items-center mb-4">
        <div>
          <Link href="/vendor" className="text-blue-600 hover:underline mb-2 inline-block">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold mb-2">{event.name}</h1>
          <p className="text-gray-600">{event.location} | Max Booths Per Vendor: {event.maxBoothsPerVendor}</p>
        </div>
        <LogoutButton />
      </div>

      {fees.length > 0 && (
        <div className="bg-white border rounded-lg p-4 mb-4 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-2">ค่าธรรมเนียมของงาน</h2>
          <div className="divide-y text-sm">
            {fees.map((fee, idx) => (
              <div key={idx} className="py-1.5 flex justify-between items-center">
                <span className="font-medium text-gray-700">{fee.name}</span>
                <span className="text-gray-600">
                  {formatMoney(fee.amount)} บาท ({fee.type === "PER_BOOKING" ? "ต่อการจอง (คิดทุกครั้งที่จอง)" : "ต่อบูธ"})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {feesError && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg mb-4 text-sm font-medium">
          ไม่สามารถโหลดค่าธรรมเนียมได้ ยอดรวมที่แสดงอาจต่ำกว่ายอดจริง
        </div>
      )}
      
      <div className="flex justify-between items-center mb-4">
        <div className="flex space-x-2">
          <button 
            onClick={() => setViewMode("MAP")}
            className={`px-4 py-2 rounded font-medium ${viewMode === "MAP" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          >
            Map View
          </button>
          <button 
            onClick={() => setViewMode("LIST")}
            className={`px-4 py-2 rounded font-medium ${viewMode === "LIST" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          >
            List View
          </button>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm min-w-[340px]">
          <div className="flex items-center justify-between space-x-4">
            <div>
              <p className="text-sm text-gray-500">Selected ({selectedBooths.length}/{event.maxBoothsPerVendor})</p>
              <p className="font-bold text-blue-800">{selectedCodes || "None"}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">ยอดรวมทั้งหมด</p>
              <p className="font-bold text-xl text-blue-800">{formatSatang(grandTotalSatang)} บาท</p>
              <p className="text-xs text-gray-500">ยอดที่ระบบจะยืนยันเมื่อสร้างการจอง</p>
            </div>
            <button 
              onClick={handleCheckout}
              disabled={selectedBooths.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50 font-bold hover:bg-blue-700"
            >
              Proceed to Checkout
            </button>
          </div>

          {selectedBooths.length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-700">ค่าบูธ ({selectedBooths.length} บูธ):</span>
                <span className="font-medium">{formatSatang(boothSubtotalSatang)} บาท</span>
              </div>
              {feeCalculations.map((fc, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-gray-700">
                    {fc.fee.name} ({fc.fee.type === "PER_BOOKING" ? "ต่อการจอง (คิดทุกครั้งที่จอง)" : "ต่อบูธ"} x{fc.qty}):
                  </span>
                  <span className="font-medium">{formatSatang(fc.subtotalSatang)} บาท</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {viewMode === "MAP" ? (
        <div className="flex-1 flex gap-4 min-h-0">
          <div className="flex-1 bg-gray-200 border rounded overflow-hidden relative">
            <FloorplanCanvas 
              event={event} 
              booths={booths} 
              mode="VIEW" 
              selectedBoothIds={selectedBooths}
              onBoothToggle={toggleBooth}
            />
            
            <div className="absolute bottom-4 left-4 bg-white p-2 rounded shadow text-xs space-y-1 opacity-90">
              <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-emerald-500"></div><span>Available</span></div>
              <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-blue-500"></div><span>Selected</span></div>
              <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-red-500"></div><span>Booked/Pending</span></div>
              <div className="flex items-center space-x-2"><div className="w-3 h-3 bg-gray-400"></div><span>Disabled</span></div>
            </div>
          </div>
          
          {unplacedBooths.length > 0 && (
            <div className="w-64 bg-white border rounded p-4 overflow-y-auto">
              <h3 className="font-bold mb-2">Unplaced Booths</h3>
              <p className="text-xs text-gray-500 mb-4">These booths are not yet on the map but can still be selected.</p>
              <div className="space-y-2">
                {unplacedBooths.map(booth => (
                  <div key={booth.id} 
                    className={`border p-3 rounded cursor-pointer transition-colors ${
                      selectedBooths.includes(booth.id) ? "border-blue-500 bg-blue-50" : 
                      booth.status === "AVAILABLE" ? "hover:bg-gray-50" : "opacity-50 cursor-not-allowed"
                    }`}
                    onClick={() => toggleBooth(booth.id)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold">{booth.code}</span>
                      <span className="text-sm">{formatMoney(booth.price)} บาท</span>
                    </div>
                    <div className="text-xs mt-1 text-gray-500">Status: {booth.status}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto bg-white border rounded p-4">
          <h2 className="text-xl font-bold mb-4">Available Booths</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {availableBooths.map(booth => (
              <div key={booth.id} 
                className={`border p-4 rounded flex items-center justify-between cursor-pointer ${
                  selectedBooths.includes(booth.id) ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
                }`}
                onClick={() => toggleBooth(booth.id)}
              >
                <div>
                  <p className="font-bold">{booth.code}</p>
                  <p className="text-sm">{formatMoney(booth.price)} บาท</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={selectedBooths.includes(booth.id)}
                  readOnly
                  className="w-5 h-5"
                />
              </div>
            ))}
            {availableBooths.length === 0 && <p>No booths available right now.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
