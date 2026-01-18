"use client";

export default function WhatsAppButton() {
  const phoneNumber = "919958839319"; // without + or spaces
  const message = encodeURIComponent(
    "Hello Yono DMC, I am interested in a holiday package."
  );

  return (
    <a
      href={`https://wa.me/${phoneNumber}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-green-500 px-5 py-3 text-white shadow-lg hover:bg-green-600 transition"
    >
      💬 WhatsApp Us
    </a>
  );
}
