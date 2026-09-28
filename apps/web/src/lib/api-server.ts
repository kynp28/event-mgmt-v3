import { cookies } from "next/headers";

export async function getServerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  
  if (!token) {
    return null;
  }
  
  const apiUrl = process.env.API_URL || "http://localhost:4000";
  
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: {
        Cookie: `token=${token}`,
      },
      cache: "no-store",
    });
    
    if (!res.ok) {
      return null;
    }
    
    const data = await res.json();
    return data.user;
  } catch (err) {
    console.error("Error fetching session:", err);
    return null;
  }
}
