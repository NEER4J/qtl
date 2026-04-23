import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth/get-profile";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login");
  if (profile.role !== "owner") redirect("/dashboard");

  return <>{children}</>;
}
