import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";

export const dynamic = "force-dynamic";

export default async function SupplierRootPage() {
  await requireRole("supplier", "/supplier/dashboard");
  redirect("/supplier/dashboard");
}

