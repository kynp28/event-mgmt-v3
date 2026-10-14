"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { translateApiError } from "@/lib/thai-errors";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export type FeeItem = {
  id: string;
  name: string;
  amount: string;
  type: "PER_BOOKING" | "PER_BOOTH";
  createdAt?: string;
  updatedAt?: string;
};

const feeFormSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อค่าธรรมเนียม").max(100, "ชื่อต้องไม่เกิน 100 ตัวอักษร"),
  amount: z.string().trim().min(1, "กรุณากรอกจำนวนเงิน").refine((val) => {
    if (!/^-?\d+(\.\d{1,2})?$/.test(val)) return false;
    const n = parseFloat(val);
    return !isNaN(n) && n >= 0 && n <= 9999999999.99;
  }, "จำนวนเงินต้องเป็นตัวเลขทศนิยมไม่เกิน 2 ตำแหน่งและไม่ติดลบ"),
  type: z.enum(["PER_BOOKING", "PER_BOOTH"]),
});

type FeeFormValues = z.infer<typeof feeFormSchema>;

export function FeesManager({
  eventId,
  initialFees,
}: {
  eventId: string;
  initialFees: FeeItem[];
}) {
  const router = useRouter();
  const [fees, setFees] = useState<FeeItem[]>(initialFees);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FeeFormValues>({
    resolver: zodResolver(feeFormSchema),
    defaultValues: { name: "", amount: "", type: "PER_BOOKING" },
  });

  const onSubmit = async (data: FeeFormValues) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (editingId) {
        await apiFetch(`/api/organizer/events/${eventId}/fees/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
      } else {
        await apiFetch(`/api/organizer/events/${eventId}/fees`, {
          method: "POST",
          body: JSON.stringify(data),
        });
      }
      form.reset({ name: "", amount: "", type: "PER_BOOKING" });
      setEditingId(null);

      const updated = await apiFetch(`/api/organizer/events/${eventId}/fees`);
      setFees(updated);
      router.refresh();
    } catch (err: unknown) {
      const msg = translateApiError(err, "fees");
      setErrorMessage(msg);
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (fee: FeeItem) => {
    setErrorMessage(null);
    setEditingId(fee.id);
    form.reset({
      name: fee.name,
      amount: fee.amount,
      type: fee.type,
    });
  };

  const handleCancelEdit = () => {
    setErrorMessage(null);
    setEditingId(null);
    form.reset({ name: "", amount: "", type: "PER_BOOKING" });
  };

  const handleDelete = async (feeId: string) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบค่าธรรมเนียมนี้?")) return;
    setErrorMessage(null);
    try {
      await apiFetch(`/api/organizer/events/${eventId}/fees/${feeId}`, {
        method: "DELETE",
      });
      const updated = await apiFetch(`/api/organizer/events/${eventId}/fees`);
      setFees(updated);
      router.refresh();
    } catch (err: unknown) {
      const msg = translateApiError(err, "fees");
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
          {editingId ? "แก้ไขค่าธรรมเนียม" : "เพิ่มค่าธรรมเนียม"}
        </h3>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              ชื่อค่าธรรมเนียม
            </label>
            <input
              {...form.register("name")}
              className="border p-2 w-full rounded"
              placeholder="เช่น ค่าทำความสะอาด, ค่าไฟฟ้า"
            />
            {form.formState.errors.name && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              จำนวนเงิน (บาท)
            </label>
            <input
              type="number"
              step="0.01"
              {...form.register("amount")}
              className="border p-2 w-full rounded"
              placeholder="0.00"
            />
            {form.formState.errors.amount && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.amount.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              ประเภทค่าธรรมเนียม
            </label>
            <select
              {...form.register("type")}
              className="border p-2 w-full rounded"
            >
              <option value="PER_BOOKING">
                ต่อการจอง (คิดทุกครั้งที่จอง)
              </option>
              <option value="PER_BOOTH">ต่อบูธ</option>
            </select>
            {form.formState.errors.type && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.type.message}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {editingId ? "บันทึกการแก้ไข" : "สร้างค่าธรรมเนียม"}
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
              <th className="p-2">ชื่อค่าธรรมเนียม</th>
              <th className="p-2">จำนวนเงิน</th>
              <th className="p-2">ประเภท</th>
              <th className="p-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {fees.map((fee) => (
              <tr key={fee.id} className="border-b">
                <td className="p-2 font-medium">{fee.name}</td>
                <td className="p-2">{fee.amount} บาท</td>
                <td className="p-2">
                  {fee.type === "PER_BOOKING"
                    ? "ต่อการจอง (คิดทุกครั้งที่จอง)"
                    : "ต่อบูธ"}
                </td>
                <td className="p-2 space-x-2">
                  <button
                    onClick={() => handleEdit(fee)}
                    className="text-blue-600 hover:underline"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => handleDelete(fee.id)}
                    className="text-red-600 hover:underline"
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
            {fees.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500">
                  ยังไม่มีรายการค่าธรรมเนียม
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
