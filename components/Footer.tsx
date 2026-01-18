import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-100 border-t mt-16">
      <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-8 text-sm">

        <div>
          <h3 className="font-semibold mb-2">Yono DMC</h3>
          <p>Trusted Travel Agency in India</p>
          <p className="mt-2 text-xs">
            © {new Date().getFullYear()} Yono DMC
          </p>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Quick Links</h3>
          <ul className="space-y-1">
            <li><Link href="/holidays">Holiday Packages</Link></li>
            <li><Link href="/privacy-policy">Privacy Policy</Link></li>
            <li><Link href="/refund-policy">Refund Policy</Link></li>
            <li><Link href="/payment-terms">Payment Terms</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Contact</h3>
          <p>📞 +91 99588 39319</p>
          <p>📧 info@yonodmc.com</p>
          <p className="mt-2 text-xs">
            Gurugram, Haryana
          </p>
        </div>
      </div>
    </footer>
  );
}
