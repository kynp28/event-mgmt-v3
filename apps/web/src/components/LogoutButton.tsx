"use client";

import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

export function LogoutButton() {
  const router = useRouter();
  
  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push("/login");
  };

  return (
    <button 
      onClick={handleLogout} 
      className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
    >
      Logout
    </button>
  );
}
