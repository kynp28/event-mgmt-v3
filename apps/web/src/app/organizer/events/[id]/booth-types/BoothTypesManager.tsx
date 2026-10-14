"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { translateApiError } from "@/lib/thai-errors";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export type BoothTypeItem = {
  id: string;
  name: string;
  price: string;
  physicalWidth: string | null;
  physicalLength: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const boothTypeFormSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อประเภทบูธ").max(100, "ชื่อต้องไม่เกิน 100 ตัวอักษร"),
  price: z.string().trim().min(1, "กรุณากรอกราคา").refine((val) => {
    if (!/^-?\d+(\.\d{1,2})?$/.test(val)) return false;
    const n = parseFloat(val);
    return !isNaN(n) && n >= 0 && n <= 9999999999.99;
  }, "ราคาต้องเป็นตัวเลขทศนิยมไม่เกิน 2 ตำแหน่งและไม่ติดลบ"),
  physicalWidth: z.string().trim().optional().refine((val) => {
    if (!val) return true;
    if (!/^-?\d+(\.\d{1,2})?$/.test(val)) return false;
    const n = parseFloat(val);
    return !isNaN(n) && n >= 0 && n <= 999999.99;
  }, "ความกว้างต้องเป็นตัวเลขทศนิยมไม่เกิน 2 ตำแหน่งและไม่ติดลบ"),
  physicalLength: z.string().trim().optional().refine((val) => {
    if (!val) return true;
    if (!/^-?\d+(\.\d{1,2})?$/.test(val)) return false;
    const n = parseFloat(val);
    return !isNaN(n) && n >= 0 && n <= 999999.99;
  }, "ความยาวต้องเป็นตัวเลขทศนิยมไม่เกิน 2 ตำแหน่งและไม่ติดลบ"),
});

type BoothTypeFormValues = z.infer<typeof boothTypeFormSchema>;

export function BoothTypesManager({
  eventId,
  initialBoothTypes,
}: {
  eventId: string;
  initialBoothTypes: BoothTypeItem[];
}) {
  const router = useRouter();
  const [boothTypes, setBoothTypes] = useState<BoothTypeItem[]>(initialBoothTypes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BoothTypeFormValues>({
    resolver: zodResolver(boothTypeFormSchema),
    defaultValues: { name: "", price: "", physicalWidth: "", physicalLength: "" },
  });

  const onSubmit = async (data: BoothTypeFormValues) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    const payload = {
      name: data.name,
      price: data.price,
      physicalWidth: data.physicalWidth ? data.physicalWidth : null,
      physicalLength: data.physicalLength ? data.physicalLength : null,
    };

    try {
      if (editingId) {
        await apiFetch(`/api/organizer/events/${eventId}/booth-types/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/organizer/events/${eventId}/booth-types`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      form.reset({ name: "", price: "", physicalWidth: "", physicalLength: "" });
      setEditingId(null);

      const updated = await apiFetch(`/api/organizer/events/${eventId}/booth-types`);
      setBoothTypes(updated);
      router.refresh();
    } catch (err: unknown) {
      const msg = translateApiError(err, "booth-types");
      setErrorMessage(msg);
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (bt: BoothTypeItem) => {
    setErrorMessage(null);
    setEditingId(bt.id);
    form.reset({
      name: bt.name,
      price: bt.price,
      physicalWidth: bt.physicalWidth || "",
      physicalLength: bt.physicalLength || "",
    });
  };

  const handleCancelEdit = () => {
    setErrorMessage(null);
    setEditingId(null);
    form.reset({ name: "", price: "", physicalWidth: "", physicalLength: "" });
  };

  const handleDelete = async (typeId: string) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบประเภทบูธนี้?")) return;
    setErrorMessage(null);
    try {
      await apiFetch(`/api/organizer/events/${eventId}/booth-types/${typeId}`, {
        method: "DELETE",
      });
      const updated = await apiFetch(`/api/organizer/events/${eventId}/booth-types`);
      setBoothTypes(updated);
      router.refresh();
    } catch (err: unknown) {
      const msg = translateApiError(err, "booth-types");
      setErrorMessage(msg);
      alert(msg);
    }
  };

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="p-3 bg-red-50 text-red-600 rounded text-sm max-w-xl">
          {errorMessage}
        </div>
      )}

      <div className="bg-white p-4 rounded shadow max-w-xl">
        <h3 className="font-medium mb-4">
          {editingId ? "แก้ไขประเภทบูธ" : "สร้างประเภทบูธ"}
        </h3>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              ชื่อประเภทบูธ
            </label>
            <input
              {...form.register("name")}
              className="border p-2 w-full rounded"
              placeholder="เช่น บูธมาตรฐาน, บูธหัวมุม"
            />
            {form.formState.errors.name && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              ราคา (บาท)
            </label>
            <input
              type="number"
              step="0.01"
              {...form.register("price")}
              className="border p-2 w-full rounded"
              placeholder="0.00"
            />
            {form.formState.errors.price && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.price.message}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">
                ความยาว (เมตร)
              </label>
              <input
                type="number"
                step="0.01"
                {...form.register("physicalLength")}
                className="border p-2 w-full rounded"
                placeholder="เช่น 3.00"
              />
              {form.formState.errors.physicalLength && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.physicalLength.message}
                </p>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">
                ความกว้าง (เมตร)
              </label>
              <input
                type="number"
                step="0.01"
                {...form.register("physicalWidth")}
                className="border p-2 w-full rounded"
                placeholder="เช่น 3.00"
              />
              {form.formState.errors.physicalWidth && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.physicalWidth.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {editingId ? "บันทึกการแก้ไข" : "สร้างประเภทบูธ"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="p-2">ชื่อประเภทบูธ</th>
              <th className="p-2">ราคา</th>
              <th className="p-2">ขนาด (กว้าง x ยาว)</th>
              <th className="p-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {boothTypes.map((bt) => (
              <tr key={bt.id} className="border-b">
                <td className="p-2 font-medium">{bt.name}</td>
                <td className="p-2">{bt.price} บาท</td>
                <td className="p-2">
                  {bt.physicalWidth && bt.physicalLength
                    ? `${bt.physicalWidth} x ${bt.physicalLength} ม.`
                    : "-"}
                </td>
                <td className="p-2 space-x-2">
                  <button
                    onClick={() => handleEdit(bt)}
                    className="text-blue-600 hover:underline"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => handleDelete(bt.id)}
                    className="text-red-600 hover:underline"
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
            {boothTypes.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500">
                  ยังไม่มีประเภทบูธ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
