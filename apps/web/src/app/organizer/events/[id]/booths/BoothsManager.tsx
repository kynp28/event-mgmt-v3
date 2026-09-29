"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBoothSchema } from "@eventcore/shared";

type Booth = {
  id: string;
  code: string;
  zoneId: string | null;
  price: string;
  physicalLength: string | null;
  physicalWidth: string | null;
  status: string;
};

type Zone = {
  id: string;
  name: string;
};

export function BoothsManager({ eventId, initialBooths, zones }: { eventId: string; initialBooths: Booth[]; zones: Zone[] }) {
  const router = useRouter();
  const [booths, setBooths] = useState<Booth[]>(initialBooths);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const form = useForm({
    resolver: zodResolver(createBoothSchema) as any,
    defaultValues: { code: "", zoneId: "", price: "", physicalLength: "", physicalWidth: "", status: "AVAILABLE" }
  });

  const onSubmit = async (data: any) => {
    // If zoneId is empty string, convert to null or remove it so Zod/Prisma is happy
    const payload = { ...data };
    if (!payload.zoneId) payload.zoneId = null;
    if (!payload.physicalLength) payload.physicalLength = null;
    if (!payload.physicalWidth) payload.physicalWidth = null;

    try {
      if (editingId) {
        await apiFetch(`/api/organizer/events/${eventId}/booths/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch(`/api/organizer/events/${eventId}/booths`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      form.reset({ code: "", zoneId: "", price: "", physicalLength: "", physicalWidth: "", status: "AVAILABLE" });
      setEditingId(null);
      
      const updated = await apiFetch(`/api/organizer/events/${eventId}/booths`);
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
      await apiFetch(`/api/organizer/events/${eventId}/booths/${boothId}`, { method: "DELETE" });
      const updated = await apiFetch(`/api/organizer/events/${eventId}/booths`);
      setBooths(updated);
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded shadow max-w-2xl">
        <h3 className="font-medium mb-4">{editingId ? "Edit Booth" : "Create Booth"}</h3>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
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
          <div>
            <label className="block text-sm">Length (m)</label>
            <input type="number" step="0.01" {...form.register("physicalLength")} className="border p-2 w-full rounded" />
          </div>
          <div>
            <label className="block text-sm">Width (m)</label>
            <input type="number" step="0.01" {...form.register("physicalWidth")} className="border p-2 w-full rounded" />
          </div>
          
          <div className="col-span-2 flex gap-2 mt-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
              {editingId ? "Save Changes" : "Create"}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); form.reset({ code: "", zoneId: "", price: "", physicalLength: "", physicalWidth: "", status: "AVAILABLE" }); }} className="bg-gray-200 px-4 py-2 rounded">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="p-2">Code</th>
              <th className="p-2">Zone</th>
              <th className="p-2">Price</th>
              <th className="p-2">Size</th>
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
  );
}
