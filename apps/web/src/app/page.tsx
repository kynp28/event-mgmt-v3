import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/api-server";

export default async function Home() {
  const user = await getServerSession();
  
  if (!user) {
    redirect("/login");
  }
  
  if (user.role === "ADMIN") redirect("/admin");
  if (user.role === "ORGANIZER") redirect("/organizer");
  redirect("/vendor");
}
