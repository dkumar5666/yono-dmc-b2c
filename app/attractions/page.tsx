"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Compass, Loader2, MapPin } from "lucide-react";

type Activity = {
  id: string;
  name: string;
  description: string;
  image: string | null;
  bookingLink: string | null;
  amount: number;
  currency: string;
};

export default function AttractionsPage() {
  const [destination, setDestination] = useState("Dubai");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/activities/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, radius: 20 }),
      });
      const data = (await response.json()) as { activities?: Activity[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to fetch activities");
      setActivities(data.activities ?? []);
      if (!data.activities || data.activities.length === 0) {
        setError("No activities found for this destination.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch activities");
      setActivities([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold">Things To Do</h1>
          <p className="mt-3 text-slate-200">Live destination activities using provider inventory.</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <form onSubmit={onSearch} className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 flex flex-col md:flex-row gap-3">
          <label className="h-12 flex-1 rounded-xl border border-slate-300 px-3 inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#199ce0]" />
            <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Destination city" className="w-full bg-transparent outline-none" required />
          </label>
          <button type="submit" disabled={busy} className="h-12 rounded-xl bg-[#199ce0] text-white font-semibold px-6 inline-flex items-center justify-center gap-2 disabled:opacity-70">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Search
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activities.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                <Compass className="h-5 w-5 text-[#199ce0]" />
              </div>
              <h2 className="mt-3 text-lg font-bold text-slate-900 leading-snug">{item.name}</h2>
              <p className="mt-2 text-sm text-slate-600 line-clamp-3">{item.description || "Activity details available after selection."}</p>
              <p className="mt-3 text-lg font-bold text-[#f5991c]">{item.currency} {item.amount.toLocaleString("en-IN")}</p>
              <div className="mt-4 flex gap-2">
                <Link href="/build-package" className="inline-flex flex-1 items-center justify-center rounded-full bg-[#199ce0] px-4 py-2 text-sm font-semibold text-white">Add to Custom Trip</Link>
                {item.bookingLink ? (
                  <a href={item.bookingLink} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center rounded-full border border-[#199ce0] px-4 py-2 text-sm font-semibold text-[#199ce0]">Details</a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
