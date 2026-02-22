"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { BedDouble, CalendarDays, Loader2, MapPin, Users } from "lucide-react";

type HotelOffer = {
  hotelId: string;
  name: string;
  cityCode: string;
  address: string;
  rating: string;
  offerId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  totalPrice: number;
  currency: string;
  cancellationDeadline?: string;
  source: "amadeus";
};

export default function HotelsPage() {
  const [cityCode, setCityCode] = useState("DXB");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offers, setOffers] = useState<HotelOffer[]>([]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/hotels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityCode: cityCode.toUpperCase(),
          checkInDate,
          checkOutDate,
          adults,
          rooms,
          currency: "INR",
          max: 20,
        }),
      });
      const data = (await response.json()) as { offers?: HotelOffer[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to fetch hotels");
      setOffers(data.offers ?? []);
      if (!data.offers || data.offers.length === 0) {
        setError("No hotels found for selected city/date.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch hotels");
      setOffers([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold">Stays</h1>
          <p className="mt-3 text-slate-200">Live hotel search using Amadeus inventory.</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-8">
        <form onSubmit={onSearch} className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 grid gap-3 md:grid-cols-6">
          <label className="md:col-span-1 h-12 rounded-xl border border-slate-300 px-3 inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#199ce0]" />
            <input value={cityCode} onChange={(e) => setCityCode(e.target.value.toUpperCase())} maxLength={3} placeholder="City" className="w-full bg-transparent outline-none" />
          </label>
          <label className="md:col-span-1 h-12 rounded-xl border border-slate-300 px-3 inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#199ce0]" />
            <input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} className="w-full bg-transparent outline-none" required />
          </label>
          <label className="md:col-span-1 h-12 rounded-xl border border-slate-300 px-3 inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#199ce0]" />
            <input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} className="w-full bg-transparent outline-none" required />
          </label>
          <label className="md:col-span-1 h-12 rounded-xl border border-slate-300 px-3 inline-flex items-center gap-2">
            <Users className="h-4 w-4 text-[#199ce0]" />
            <input type="number" min={1} max={8} value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="w-full bg-transparent outline-none" />
          </label>
          <label className="md:col-span-1 h-12 rounded-xl border border-slate-300 px-3 inline-flex items-center gap-2">
            <BedDouble className="h-4 w-4 text-[#199ce0]" />
            <input type="number" min={1} max={4} value={rooms} onChange={(e) => setRooms(Number(e.target.value))} className="w-full bg-transparent outline-none" />
          </label>
          <button type="submit" disabled={busy} className="md:col-span-1 h-12 rounded-xl bg-[#199ce0] text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-70">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Search
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {offers.map((hotel) => (
            <article key={`${hotel.hotelId}-${hotel.offerId}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">{hotel.cityCode}</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{hotel.name}</h2>
              <p className="text-sm text-slate-600 mt-1 line-clamp-2">{hotel.address || "Address unavailable"}</p>
              <p className="mt-2 text-sm text-slate-700">Rating: <span className="font-semibold">{hotel.rating}</span></p>
              <p className="mt-1 text-sm text-slate-700">{hotel.checkInDate} to {hotel.checkOutDate}</p>
              <p className="mt-3 text-xl font-bold text-[#f5991c]">{hotel.currency} {hotel.totalPrice.toLocaleString("en-IN")}</p>
              <div className="mt-4 flex gap-2">
                <Link href="/flights" className="inline-flex flex-1 items-center justify-center rounded-full border border-[#199ce0] px-4 py-2 text-sm font-semibold text-[#199ce0]">Add Flights</Link>
                <Link href="/build-package" className="inline-flex flex-1 items-center justify-center rounded-full bg-[#199ce0] px-4 py-2 text-sm font-semibold text-white">Customize</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
