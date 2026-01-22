"use client";

import { useState } from "react";

const airlineNames: Record<string, string> = {
  AI: "Air India",
  EK: "Emirates",
  SG: "SpiceJet",
  UK: "Vistara",
  "6E": "IndiGo",
  IX: "Air India Express",
};

export default function FlightsPage() {
  const [from, setFrom] = useState("DEL");
  const [to, setTo] = useState("DXB");
  const [date, setDate] = useState("2026-01-31");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState("");

  const searchFlights = async () => {
    try {
      setLoading(true);
      setError("");
      setResults([]);

      const res = await fetch(
        `/api/flights?from=${from}&to=${to}&date=${date}`
      );

      const data = await res.json();

      if (!data || !data.data || !Array.isArray(data.data)) {
        throw new Error("Invalid API response");
      }

      setResults(data.data);
    } catch (err: any) {
      setError("Failed to fetch flights");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Search Flights</h1>

      {/* Search Form */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <input
          className="border p-2 rounded"
          value={from}
          onChange={(e) => setFrom(e.target.value.toUpperCase())}
          placeholder="From (DEL)"
        />
        <input
          className="border p-2 rounded"
          value={to}
          onChange={(e) => setTo(e.target.value.toUpperCase())}
          placeholder="To (DXB)"
        />
        <input
          type="date"
          className="border p-2 rounded"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button
          onClick={searchFlights}
          className="bg-blue-600 text-white rounded px-4 py-2"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Status */}
      {error && <p className="text-red-600">{error}</p>}
      {loading && <p>Loading flights...</p>}

      {/* Results */}
      {!loading && results.length === 0 && !error && (
        <p className="text-gray-500">No results yet</p>
      )}

      <div className="space-y-4 mt-6">
        {results.map((flight: any, index: number) => {
          const itinerary = flight.itineraries?.[0];
          if (!itinerary) return null;

          const segment = itinerary.segments?.[0];
          if (!segment) return null;

          const depTime = new Date(segment.departure.at).toLocaleTimeString(
            [],
            { hour: "2-digit", minute: "2-digit" }
          );

          const arrTime = new Date(segment.arrival.at).toLocaleTimeString(
            [],
            { hour: "2-digit", minute: "2-digit" }
          );

          const airlineCode = segment.carrierCode;
          const airlineName =
            airlineNames[airlineCode] || airlineCode;

          const whatsappMsg = encodeURIComponent(
            `Hi Yono DMC, I want to book this flight:\n\n${from} → ${to}\nDate: ${date}\nAirline: ${airlineName}\nPrice: ₹${flight.price.total}`
          );

          return (
            <div
              key={index}
              className="border rounded-lg p-4 flex flex-col md:flex-row justify-between items-center"
            >
              <div>
                <p className="font-semibold text-lg">
                  {from} → {to}
                </p>
                <p className="text-gray-600">
                  {depTime} - {arrTime} | {airlineName}
                </p>
              </div>

              <div className="mt-3 md:mt-0 flex items-center gap-4">
                <p className="text-xl font-bold">
                  ₹{flight.price.total}
                </p>
                <a
                  href={`https://wa.me/919958839319?text=${whatsappMsg}`}
                  target="_blank"
                  className="bg-green-600 text-white px-4 py-2 rounded"
                >
                  Enquire on WhatsApp
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
