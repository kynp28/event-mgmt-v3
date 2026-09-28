import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { UserSession } from "@eventcore/shared";

function useAuthGuard(role: string) {
  const navigate = useNavigate();
  return useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      try {
        const res = await api.get<{ user: UserSession }>("/api/auth/me");
        if (res.data.user.role !== role) {
          navigate("/login");
        }
        return res.data.user;
      } catch {
        navigate("/login");
        throw new Error("Unauthorized");
      }
    },
    retry: false,
  });
}

export function AdminDashboard() {
  const { data: user } = useAuthGuard("ADMIN");
  
  const handleLogout = async () => {
    await api.post("/api/auth/logout");
    window.location.href = "/login";
  };

  if (!user) return null;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p>Welcome, {user.name} ({user.role})</p>
      <button onClick={handleLogout} className="mt-4 bg-red-600 text-white px-4 py-2 rounded">Logout</button>
    </div>
  );
}

export function OrganizerDashboard() {
  const { data: user } = useAuthGuard("ORGANIZER");
  
  const handleLogout = async () => {
    await api.post("/api/auth/logout");
    window.location.href = "/login";
  };

  if (!user) return null;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Organizer Dashboard</h1>
      <p>Welcome, {user.name} ({user.role})</p>
      <button onClick={handleLogout} className="mt-4 bg-red-600 text-white px-4 py-2 rounded">Logout</button>
    </div>
  );
}

export function VendorDashboard() {
  const { data: user } = useAuthGuard("VENDOR");
  
  const handleLogout = async () => {
    await api.post("/api/auth/logout");
    window.location.href = "/login";
  };

  if (!user) return null;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Vendor Dashboard</h1>
      <p>Welcome, {user.name} ({user.role})</p>
      <button onClick={handleLogout} className="mt-4 bg-red-600 text-white px-4 py-2 rounded">Logout</button>
    </div>
  );
}
