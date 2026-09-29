"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBoothSchema } from "@eventcore/shared";
import dynamic from "next/dynamic";

const FloorplanEditor = dynamic(() => import("./FloorplanEditor"), { ssr: false });

type Booth = {
  id: string;
  code: string;
  zoneId: string | null;
  price: string;
  physicalLength: string | null;
  physicalWidth: string | null;
  status: string;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  rotation: number | null;
};

type Zone = { id: string; name: string; };

export function BoothsManager({ event, initialBooths, zones }: { event: any; initialBooths: Booth[]; zones: Zone[] }) {
  const router = useRouter();
  const [booths, setBooths] = useState<Booth[]>(initialBooths);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"TABLE" | "FLOORPLAN">("TABLE");
  const [isSavingPositions, setIsSavingPositions] = useState(false);
  
  const form = useForm({
    resolver: zodResolver(createBoothSchema) as any,
    defaultValues: { code: "", zoneId: "", price: "", physicalLength: "", physicalWidth: "", status: "AVAILABLE" }
  });

  const onSubmit = async (data: any) => {
    const payload = { ...data };
    if (!payload.zoneId) payload.zoneId = null;
    if (!payload.physicalLength) payload.physicalLength = null;
    if (!payload.physicalWidth) payload.physicalWidth = null;

    try {
      if (editingId) {
        await apiFetch(`/api/organizer/events/${event.id}/booths/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch(`/api/organizer/events/${event.id}/booths`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      form.reset({ code: "", zoneId: "", price: "", physicalLength: "", physicalWidth: "", status: "AVAILABLE" });
      setEditingId(null);
      
      const updated = await apiFetch(`/api/organizer/events/${event.id}/booths`);
      setBooths(updated);
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEdit = (b: Booth) => {
    setEditingId(b.id);
    form.reset({ 
      code: b.code, 
      zoneId: b.zoneId || "", 
      price: b.price, 
      physicalLength: b.physicalLength || "", 
      physicalWidth: b.physicalWidth || "",
      status: b.status 
    });
  };

  const handleDelete = async (boothId: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await apiFetch(`/api/organizer/events/${event.id}/booths/${boothId}`, { method: "DELETE" });
      const updated = await apiFetch(`/api/organizer/events/${event.id}/booths`);
      setBooths(updated);
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const savePositions = async () => {
    setIsSavingPositions(true);
    try {
      const payload = {
        positions: booths.map(b => ({
          boothId: b.id,
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          rotation: b.rotation
        }))
      };
      await apiFetch(`/api/organizer/events/${event.id}/booths/positions`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      alert("Positions saved successfully!");
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingPositions(false);
    }
  };

  const handleMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2.8 * 1024 * 1024) {
      alert("Image must be less than 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await apiFetch(`/api/organizer/events/${event.id}`, {
          method: "PATCH",
          body: JSON.stringify({ floorplanImage: ev.target?.result })
        });
        alert("Map background updated! Refreshing...");
        router.refresh();
      } catch (err: any) {
        alert(err.message);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button 
          className={`py-2 px-4 ${activeTab === "TABLE" ? "border-b-2 border-blue-600 text-blue-600 font-bold" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => setActiveTab("TABLE")}
        >
          Table View
        </button>
        <button 
          className={`py-2 px-4 ${activeTab === "FLOORPLAN" ? "border-b-2 border-blue-600 text-blue-600 font-bold" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => setActiveTab("FLOORPLAN")}
        >
          Floorplan Canvas
        </button>
      </div>

      {activeTab === "TABLE" && (
        <div className="flex gap-6 overflow-auto">
          {/* Form */}
          <div className="bg-white p-4 rounded shadow w-80 shrink-0 self-start">
            <h3 className="font-medium mb-4">{editingId ? "Edit Booth" : "Create Booth"}</h3>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm">Code</label>
                <input {...form.register("code")} className="border p-2 w-full rounded" placeholder="e.g. A10" />
                {form.formState.errors.code && <p className="text-red-500 text-sm">{form.formState.errors.code.message as string}</p>}
              </div>
              <div>
                <label className="block text-sm">Zone</label>
                <select {...form.register("zoneId")} className="border p-2 w-full rounded">
                  <option value="">-- No Zone --</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm">Price</label>
                <input type="number" step="0.01" {...form.register("price")} className="border p-2 w-full rounded" />
                {form.formState.errors.price && <p className="text-red-500 text-sm">{form.formState.errors.price.message as string}</p>}
              </div>
              <div>
                <label className="block text-sm">Status</label>
                <select {...form.register("status")} className="border p-2 w-full rounded">
                  <option value="AVAILABLE">Available</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm">Length (m)</label>
                  <input type="number" step="0.01" {...form.register("physicalLength")} className="border p-2 w-full rounded" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm">Width (m)</label>
                  <input type="number" step="0.01" {...form.register("physicalWidth")} className="border p-2 w-full rounded" />
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded flex-1">
                  {editingId ? "Save" : "Create"}
                </button>
                {editingId && (
                  <button type="button" onClick={() => { setEditingId(null); form.reset({ code: "", zoneId: "", price: "", physicalLength: "", physicalWidth: "", status: "AVAILABLE" }); }} className="bg-gray-200 px-4 py-2 rounded flex-1">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Table */}
          <div className="bg-white p-4 rounded shadow flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Code</th>
                  <th className="p-2">Zone</th>
                  <th className="p-2">Price</th>
                  <th className="p-2">Size (m)</th>
                  <th className="p-2">Map (x, y, w, h)</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {booths.map(b => {
                  const zone = zones.find(z => z.id === b.zoneId);
                  const isLocked = b.status === "BOOKED" || b.status === "PAYMENT_PENDING";
                  return (
                    <tr key={b.id} className="border-b">
                      <td className="p-2 font-medium">{b.code}</td>
                      <td className="p-2">
                        {zone ? (
                          <span className="px-2 py-1 bg-gray-100 rounded text-sm">{zone.name}</span>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-2">${b.price}</td>
                      <td className="p-2">
                        {b.physicalLength && b.physicalWidth ? `${b.physicalLength}x${b.physicalWidth}m` : "-"}
                      </td>
                      <td className="p-2 font-mono text-xs text-gray-500">
                        {b.x !== null ? `${b.x}, ${b.y} (${b.width}x${b.height})` : "Unplaced"}
                      </td>
                      <td className="p-2">{b.status}</td>
                      <td className="p-2 space-x-2">
                        {!isLocked ? (
                          <>
                            <button onClick={() => handleEdit(b)} className="text-blue-600 hover:underline">Edit</button>
                            <button onClick={() => handleDelete(b.id)} className="text-red-600 hover:underline">Delete</button>
                          </>
                        ) : (
                          <span className="text-gray-400 text-sm">Locked</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {booths.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-500">No booths created yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "FLOORPLAN" && (
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-600">Drag booths from the left tray onto the map. They will snap to a 20px grid.</p>
            <div className="space-x-2 flex items-center">
              <label className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded cursor-pointer">
                Upload Venue Map
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleMapUpload} />
              </label>
              <button 
                onClick={savePositions} 
                disabled={isSavingPositions}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                {isSavingPositions ? "Saving..." : "Save Layout"}
              </button>
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden">
             <FloorplanEditor event={event} booths={booths} onBoothsChange={setBooths} />
          </div>
        </div>
      )}
    </div>
  );
}
