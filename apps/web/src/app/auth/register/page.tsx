"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { registerVendorSchema } from "@eventcore/shared";
import { apiFetch } from "@/lib/api-client";
import { translateFieldError, translateApiError } from "@/lib/thai-errors";

type FormValues = {
  email: string;
  password: string;
  name?: string | null;
  storeName: string;
  productType: string;
};

export default function RegisterVendorPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(registerVendorSchema),
    defaultValues: { email: "", password: "", name: "", storeName: "", productType: "" },
  });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      const email = data.email.trim();
      const name = data.name ? data.name.trim() : "";
      const storeName = data.storeName.trim();
      const productType = data.productType.trim();
      const password = data.password; // Do not trim password

      // Build payload exactly as schema expects
      const payload: Record<string, string> = {
        email,
        password,
        storeName,
        productType
      };
      
      if (name) {
        payload.name = name;
      }

      await apiFetch("/api/auth/register/vendor", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      
      // On success (201), the API sets the cookie via proxy
      router.push("/vendor");
      
    } catch (err: unknown) {
      setServerError(translateApiError(err, "register"));
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 py-8 px-4">
      <div className="z-10 w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 shadow-xl bg-white p-8">
        <h3 className="text-xl font-semibold mb-6 text-center">สมัครสมาชิกผู้ค้า</h3>
        
        {serverError && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-6">
            {serverError}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs text-gray-600 uppercase mb-1">อีเมล</label>
            <input 
              id="email"
              type="email"
              autoComplete="email"
              {...form.register("email")}
              className="w-full rounded border px-3 py-2"
            />
            {form.formState.errors.email && (
              <p className="text-red-500 text-xs mt-1">{translateFieldError(form.formState.errors.email.message || "")}</p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="block text-xs text-gray-600 uppercase mb-1">รหัสผ่าน</label>
            <input 
              id="password"
              type="password"
              autoComplete="new-password"
              {...form.register("password")}
              className="w-full rounded border px-3 py-2"
            />
            {form.formState.errors.password && (
              <p className="text-red-500 text-xs mt-1">{translateFieldError(form.formState.errors.password.message || "")}</p>
            )}
          </div>
          <div>
            <label htmlFor="name" className="block text-xs text-gray-600 uppercase mb-1">ชื่อผู้ติดต่อ (ไม่บังคับ)</label>
            <input 
              id="name"
              type="text"
              autoComplete="name"
              {...form.register("name")}
              className="w-full rounded border px-3 py-2"
            />
            {form.formState.errors.name && (
              <p className="text-red-500 text-xs mt-1">{translateFieldError(form.formState.errors.name.message || "")}</p>
            )}
          </div>
          <div>
            <label htmlFor="storeName" className="block text-xs text-gray-600 uppercase mb-1">ชื่อร้านค้า</label>
            <input 
              id="storeName"
              type="text"
              autoComplete="organization"
              {...form.register("storeName")}
              className="w-full rounded border px-3 py-2"
            />
            {form.formState.errors.storeName && (
              <p className="text-red-500 text-xs mt-1">{translateFieldError(form.formState.errors.storeName.message || "")}</p>
            )}
          </div>
          <div>
            <label htmlFor="productType" className="block text-xs text-gray-600 uppercase mb-1">ประเภทสินค้า</label>
            <input 
              id="productType"
              type="text"
              {...form.register("productType")}
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
            {form.formState.isSubmitting ? "กำลังสมัคร..." : "สมัครสมาชิก"}
          </button>
        </form>
      </div>
    </div>
  );
}
