"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createZoneSchema } from "@eventcore/shared";

type Zone = {
  id: string;
  name: string;
  color: string | null;
};

export function ZonesManager({ eventId, initialZones }: { eventId: string; initialZones: Zone[] }) {
  const router = useRouter();
  const [zones, setZones] = useState<Zone[]>(initialZones);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const form = useForm({
    resolver: zodResolver(createZoneSchema) as any,
    defaultValues: { name: "", color: "" }
  });

  const onSubmit = async (data: any) => {
    try {
      if (editingId) {
        await apiFetch(`/api/organizer/events/${eventId}/zones/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(data)
        });
      } else {
        await apiFetch(`/api/organizer/events/${eventId}/zones`, {
          method: "POST",
          body: JSON.stringify(data)
        });
      }
      form.reset({ name: "", color: "" });
      setEditingId(null);
      
      // Refresh list
      const updated = await apiFetch(`/api/organizer/events/${eventId}/zones`);
      setZones(updated);
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEdit = (z: Zone) => {
    setEditingId(z.id);
    form.reset({ name: z.name, color: z.color || "" });
  };

  const handleDelete = async (zoneId: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await apiFetch(`/api/organizer/events/${eventId}/zones/${zoneId}`, { method: "DELETE" });
      const updated = await apiFetch(`/api/organizer/events/${eventId}/zones`);
      setZones(updated);
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded shadow max-w-xl">
        <h3 className="font-medium mb-4">{editingId ? "Edit Zone" : "Create Zone"}</h3>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm">Name</label>
            <input {...form.register("name")} className="border p-2 w-full rounded" />
            {form.formState.errors.name && <p className="text-red-500 text-sm">{form.formState.errors.name.message as string}</p>}
          </div>
          <div>
            <label className="block text-sm">Color (Optional Hex)</label>
            <input {...form.register("color")} className="border p-2 w-full rounded" placeholder="#ff0000" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
              {editingId ? "Save Changes" : "Create"}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); form.reset({ name: "", color: "" }); }} className="bg-gray-200 px-4 py-2 rounded">
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
              <th className="p-2">Name</th>
              <th className="p-2">Color</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {zones.map(z => (
              <tr key={z.id} className="border-b">
                <td className="p-2">{z.name}</td>
                <td className="p-2">
                  {z.color && (
                    <span className="inline-block w-4 h-4 rounded-full mr-2" style={{ backgroundColor: z.color }}></span>
                  )}
                  {z.color || "-"}
                </td>
                <td className="p-2 space-x-2">
                  <button onClick={() => handleEdit(z)} className="text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => handleDelete(z.id)} className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {zones.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-500">No zones created yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
