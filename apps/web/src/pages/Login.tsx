import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { loginSchema } from "@eventcore/shared";
import type { LoginPayload, UserSession } from "@eventcore/shared";
import { api } from "../lib/api";

export function LoginPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  // Check auth state
  useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      const res = await api.get<{ user: UserSession }>("/api/auth/me");
      const role = res.data.user.role;
      if (role === "ADMIN") navigate("/admin");
      else if (role === "ORGANIZER") navigate("/organizer");
      else navigate("/vendor");
      return res.data;
    },
    retry: false,
  });

  const form = useForm<LoginPayload>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginPayload) => {
    setServerError(null);
    try {
      await api.post("/api/auth/login", data);
      
      const res = await api.get<{ user: UserSession }>("/api/auth/me");
      const role = res.data.user.role;
      if (role === "ADMIN") navigate("/admin");
      else if (role === "ORGANIZER") navigate("/organizer");
      else navigate("/vendor");
      
    } catch (err: any) {
      setServerError(err.response?.data?.error?.message || "An error occurred");
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
      <div className="z-10 w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 shadow-xl bg-white p-8">
        <h3 className="text-xl font-semibold mb-4 text-center">Sign in to EventCore</h3>
        
        {serverError && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-4">
            {serverError}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-600 uppercase mb-1">Email</label>
            <input 
              {...form.register("email")}
              className="w-full rounded border px-3 py-2"
            />
            {form.formState.errors.email && (
              <p className="text-red-500 text-xs mt-1">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-600 uppercase mb-1">Password</label>
            <input 
              type="password"
              {...form.register("password")}
              className="w-full rounded border px-3 py-2"
            />
            {form.formState.errors.password && (
              <p className="text-red-500 text-xs mt-1">{form.formState.errors.password.message}</p>
            )}
          </div>
          <button 
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full bg-black text-white rounded py-2 mt-4 hover:bg-gray-800 disabled:opacity-50"
          >
            {form.formState.isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
