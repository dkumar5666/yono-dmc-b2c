export default function PaymentTermsPage() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-6">Payment Terms</h1>

      <p className="text-gray-700 mb-4">
        All bookings with Yono DMC are subject to the following payment terms.
      </p>

      <ul className="list-disc pl-6 space-y-2 text-gray-700">
        <li>Advance payment is required to confirm any booking.</li>
        <li>Prices are subject to availability at the time of confirmation.</li>
        <li>Final payment must be cleared before travel.</li>
        <li>Cancellation charges may apply as per supplier policy.</li>
      </ul>
    </section>
  );
}
