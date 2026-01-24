import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="Yono DMC"
            width={120}
            height={32}
            className="object-contain"
            priority
          />
        </Link>

        <nav className="hidden md:flex gap-6 text-sm font-medium">
          <Link href="/">Home</Link>
          <Link href="/packages">Packages</Link>
          <Link href="/destinations">Destinations</Link>
          <Link href="/flights">Flights</Link>
          <Link href="/hotels">Hotels</Link>
          <Link href="/visa">Visa</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </nav>

        <Link
          href="/contact"
          className="bg-[#f5991c] text-white px-5 py-2 rounded-full text-sm font-semibold"
        >
          Enquire Now
        </Link>
      </div>
    </header>
  );
}
