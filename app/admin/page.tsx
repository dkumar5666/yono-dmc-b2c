import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";

export const dynamic = "force-dynamic";

export default async function AdminRootPage() {
  await requireRole("admin", "/admin/control-center");
  redirect("/admin/control-center");
}

