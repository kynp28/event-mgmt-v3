import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role;

  if (role === "ADMIN") {
    redirect("/admin");
  } else if (role === "ORGANIZER") {
    redirect("/organizer");
  } else {
    redirect("/vendor");
  }
}
