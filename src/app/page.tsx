import { redirect } from "next/navigation";

export default function Home() {
  // Redirect to dashboard
  // In production, this would check auth and redirect to login if not authenticated
  redirect("/dashboard");
}
