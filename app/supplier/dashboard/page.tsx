import Link from "next/link";
import { requireRole } from "@/lib/auth/requireRole";

export const dynamic = "force-dynamic";

export default async function SupplierDashboardPage() {
  const identity = await requireRole("supplier", "/supplier/dashboard");

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#199ce0]">Supplier Portal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Welcome, {identity.fullName || "Partner"}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Supplier access is active. This dashboard is now role-protected and ready for your upcoming supplier modules.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Role</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">Supplier</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Email</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{identity.email || "Not available"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-slate-500">User ID</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">{identity.userId}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            Back to website
          </Link>
          <form action="/api/auth/supabase/logout" method="post">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-[#199ce0] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#148bc7]"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

