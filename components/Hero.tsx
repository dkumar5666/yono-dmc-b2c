import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative h-[500px] flex items-center">
      <Image
        src="/images/home/hero.png"
        alt="Travel with Yono DMC"
        fill
        className="object-cover"
        priority
      />

      <div className="absolute inset-0 bg-black/50" />

      <div className="relative max-w-4xl mx-auto px-6 text-white">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Trusted Travel Agency in India
        </h1>
        <p className="mb-6 text-lg">
          Domestic & International Holiday Packages including Dubai, Bali,
          Singapore, Malaysia and more.
        </p>

        <a
          href="https://wa.me/919958839319"
          className="inline-block bg-primary px-6 py-3 rounded text-white font-semibold"
        >
          WhatsApp Us
        </a>
      </div>
    </section>
  );
}
