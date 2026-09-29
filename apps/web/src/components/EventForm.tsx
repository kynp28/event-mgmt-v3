"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createEventSchema, CreateEventPayload } from "@eventcore/shared";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useState } from "react";

interface FormInput {
  name: string;
  description?: string | null;
  location: string;
  maxBoothsPerVendor?: number;
  coverImage?: string | null;
  startDate: string;
  endDate: string;
}

export function EventForm({
  initialData,
  eventId,
}: {
  initialData?: Partial<FormInput>;
  eventId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  const form = useForm<FormInput>({
    resolver: zodResolver(createEventSchema) as any,
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      location: initialData?.location || "",
      maxBoothsPerVendor: initialData?.maxBoothsPerVendor || 3,
      coverImage: initialData?.coverImage || "",
      startDate: initialData?.startDate || new Date().toISOString().split("T")[0],
      endDate: initialData?.endDate || new Date().toISOString().split("T")[0],
    },
  });

  const onSubmit = async (data: any) => {
    try {
      setError("");
      if (eventId) {
        await apiFetch(`/api/organizer/events/${eventId}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
      } else {
        await apiFetch("/api/organizer/events", {
          method: "POST",
          body: JSON.stringify(data),
        });
      }

      router.push("/organizer/events");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2.8 * 1024 * 1024) {
      setError("Image must be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      form.setValue("coverImage", event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}

      <div>
        <label className="block font-medium mb-1">Name</label>
        <input {...form.register("name")} className="w-full border rounded p-2" />
        {form.formState.errors.name && (
          <p className="text-red-500 text-sm mt-1">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block font-medium mb-1">Description</label>
        <textarea {...form.register("description")} className="w-full border rounded p-2" rows={4} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-medium mb-1">Start Date</label>
          <input
            type="date"
            {...form.register("startDate")}
            className="w-full border rounded p-2"
          />
          {form.formState.errors.startDate && (
            <p className="text-red-500 text-sm mt-1">{form.formState.errors.startDate.message}</p>
          )}
        </div>
        <div>
          <label className="block font-medium mb-1">End Date</label>
          <input
            type="date"
            {...form.register("endDate")}
            className="w-full border rounded p-2"
          />
          {form.formState.errors.endDate && (
            <p className="text-red-500 text-sm mt-1">{form.formState.errors.endDate.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block font-medium mb-1">Location</label>
        <input {...form.register("location")} className="w-full border rounded p-2" />
        {form.formState.errors.location && (
          <p className="text-red-500 text-sm mt-1">{form.formState.errors.location.message}</p>
        )}
      </div>

      <div>
        <label className="block font-medium mb-1">Max Booths Per Vendor</label>
        <input
          type="number"
          {...form.register("maxBoothsPerVendor")}
          className="w-full border rounded p-2"
        />
      </div>

      <div>
        <label className="block font-medium mb-1">Cover Image (JPEG/PNG/WEBP, max 2MB)</label>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="w-full" />
        {form.watch("coverImage") && (
          <img src={form.watch("coverImage")!} alt="Preview" className="mt-4 h-32 object-cover rounded" />
        )}
        {form.formState.errors.coverImage && (
          <p className="text-red-500 text-sm mt-1">{form.formState.errors.coverImage.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {form.formState.isSubmitting ? "Saving..." : "Save Event"}
      </button>
    </form>
  );
}
