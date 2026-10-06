"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateVendorProfileSchema } from "@eventcore/shared";
import type { UpdateVendorProfilePayload } from "@eventcore/shared";
import { apiFetch, ApiError } from "@/lib/api-client";
import { translateFieldError, translateApiError } from "@/lib/thai-errors";

type FormValues = {
  storeName: string;
  productType: string;
};

export default function VendorProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [is403, setIs403] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(updateVendorProfileSchema),
    defaultValues: { storeName: "", productType: "" },
  });

  const resetRef = useRef(form.reset);
  useEffect(() => {
    resetRef.current = form.reset;
  }, [form.reset]);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const res = await apiFetch("/api/vendor/profile");
        if (active) {
          resetRef.current({
            storeName: res.profile.storeName,
            productType: res.profile.productType,
          });
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!active) return;
        if (err instanceof ApiError) {
          if (err.status === 401) {
            router.push("/login");
            return;
          }
          if (err.status === 404 && err.code === "VENDOR_PROFILE_NOT_FOUND") {
            setNotice("ยังไม่มีข้อมูลร้านค้า กรุณากรอกข้อมูลเพื่อสร้างโปรไฟล์");
            resetRef.current({ storeName: "", productType: "" });
            setLoading(false);
            return;
          }
        }
        setPageError(translateApiError(err, "profile"));
        if (err instanceof ApiError && err.status === 403) {
          setIs403(true);
        }
        setLoading(false);
      }
    };
    loadProfile();
    return () => { active = false; };
  }, [router]);

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    setSuccessMsg(null);
    try {
      const payload: UpdateVendorProfilePayload = {
        storeName: data.storeName,
        productType: data.productType
      };

      await apiFetch("/api/vendor/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      
      setSuccessMsg("บันทึกข้อมูลร้านค้าเรียบร้อย");
      // Keep form filled with trimmed values
      form.reset(payload);
    } catch (err: unknown) {
      setServerError(translateApiError(err, "profile"));
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <p>กำลังโหลด...</p>
      </div>
    );
  }

  if (is403) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 text-red-600 p-4 rounded">{pageError}</div>
        <div className="mt-4">
          <Link href="/vendor" className="text-blue-600 hover:underline">กลับ</Link>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 text-red-600 p-4 rounded mb-4">{pageError}</div>
        <button onClick={() => window.location.reload()} className="bg-black text-white px-4 py-2 rounded">ลองใหม่</button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">ข้อมูลร้านค้า</h1>
        <Link href="/vendor" className="text-blue-600 hover:underline">กลับ</Link>
      </div>

      <div className="bg-white p-6 rounded shadow border border-gray-100">
        {notice && (
          <div className="bg-blue-50 text-blue-800 p-3 rounded text-sm mb-6">
            {notice}
          </div>
        )}
        
        {successMsg && (
          <div className="bg-green-50 text-green-700 p-3 rounded text-sm mb-6">
            {successMsg}
          </div>
        )}
        
        {serverError && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-6">
            {serverError}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="storeName" className="block text-sm font-medium text-gray-700 mb-1">ชื่อร้านค้า</label>
            <input 
              id="storeName"
              type="text"
              {...form.register("storeName", { setValueAs: (v) => typeof v === "string" ? v.trim() : v })}
              className="w-full rounded border px-3 py-2"
            />
            {form.formState.errors.storeName && (
              <p className="text-red-500 text-xs mt-1">{translateFieldError(form.formState.errors.storeName.message || "")}</p>
            )}
          </div>
          <div>
            <label htmlFor="productType" className="block text-sm font-medium text-gray-700 mb-1">ประเภทสินค้า</label>
            <input 
              id="productType"
              type="text"
              {...form.register("productType", { setValueAs: (v) => typeof v === "string" ? v.trim() : v })}
              className="w-full rounded border px-3 py-2"
            />
            {form.formState.errors.productType && (
              <p className="text-red-500 text-xs mt-1">{translateFieldError(form.formState.errors.productType.message || "")}</p>
            )}
          </div>
          <button 
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full bg-black text-white rounded py-2 mt-6 hover:bg-gray-800 disabled:opacity-50"
          >
            {form.formState.isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </form>
      </div>
    </div>
  );
}
