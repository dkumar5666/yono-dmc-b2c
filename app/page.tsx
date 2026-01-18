import DestinationCard from "@/components/DestinationCard";

const destinations = [
  { title: "Dubai", slug: "dubai", image: "/images/home/dubai.png" },
  { title: "Bali", slug: "bali", image: "/images/home/bali.png" },
  { title: "Singapore", slug: "singapore", image: "/images/home/singapore.png" },
  { title: "Malaysia", slug: "malaysia", image: "/images/home/malaysia.png" },
];

export default function HomePage() {
  return (
    <>
      {/* HERO BANNER */}
<section
  className="w-full h-[420px] bg-center bg-cover"
  style={{
    backgroundImage: "url('/images/home/hero.png')",
  }}
>
  <div className="w-full h-full flex items-center justify-center bg-black/40">
    <h1 className="text-white text-4xl md:text-5xl font-bold text-center px-4">
      Trusted Travel Agency in India
    </h1>
  </div>
</section>      
      {/* HERO SECTION */}
      <section className="text-center py-20">
        <h1 className="text-4xl font-bold mb-4">
          Trusted Travel Agency in India
        </h1>

        <p className="text-gray-600 max-w-2xl mx-auto mb-6">
          Domestic & International Holiday Packages including Dubai, Bali,
          Singapore, Malaysia and more.
        </p>

        <a
          href="https://wa.me/919958839319"
          className="inline-block bg-primary text-white px-6 py-3 rounded-md"
        >
          WhatsApp Us
        </a>
      </section>

      {/* DESTINATIONS */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-8 text-center">
          Popular Holiday Destinations
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {destinations.map((d) => (
            <DestinationCard key={d.slug} {...d} />
          ))}
        </div>
      </section>

      {/* TRUST SECTION */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold mb-10">
            Why Choose Yono DMC?
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <h3 className="font-semibold mb-2">✔ Trusted Agency</h3>
              <p className="text-gray-600">Serving travelers across India.</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">✔ Custom Packages</h3>
              <p className="text-gray-600">Tailor-made holidays.</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">✔ Best Prices</h3>
              <p className="text-gray-600">Direct destination deals.</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">✔ WhatsApp Support</h3>
              <p className="text-gray-600">Quick & easy assistance.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
