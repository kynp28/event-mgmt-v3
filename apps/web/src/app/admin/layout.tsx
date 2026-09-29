"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then(data => {
        if (!data.user || data.user.role !== "ADMIN") {
          router.push("/");
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  if (loading) return null;

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-white shadow-md">
        <div className="p-6 font-bold text-xl text-blue-800 border-b">Admin Panel</div>
        <nav className="p-4 flex flex-col gap-2">
          <Link href="/admin" className="p-2 hover:bg-blue-50 rounded">Dashboard</Link>
          <Link href="/admin/organizers" className="p-2 hover:bg-blue-50 rounded">Organizers (Pending)</Link>
          <Link href="/admin/users" className="p-2 hover:bg-blue-50 rounded">All Users</Link>
          <Link href="/admin/events" className="p-2 hover:bg-blue-50 rounded">All Events</Link>
        </nav>
      </div>
      <div className="flex-1 overflow-auto p-8">
        {children}
      </div>
    </div>
  );
}
