import { holidays } from "@/data/holidays";
import CTA from "@/components/CTA";
import { notFound } from "next/navigation";

type Props = {
  params: { slug: string };
};

export default function DestinationPage({ params }: Props) {
  const destination = holidays.find(
    (item) => item.slug === params.slug
  );

  if (!destination) return notFound();

  return (
    <section className="max-w-5xl mx-auto px-4">
      <h1 className="mb-4">{destination.title}</h1>

      <p className="mb-6 text-lg text-gray-600">
        {destination.description}
      </p>

      <img
        src={destination.image}
        alt={destination.title}
        className="rounded-xl mb-10"
      />

      <div className="space-y-4 text-gray-700">
        <p>
          Explore our carefully designed {destination.title.toLowerCase()}.
          We offer customizable itineraries, best hotels, sightseeing,
          transfers, and visa assistance.
        </p>

        <p>
          Our travel experts ensure you get the best value with
          stress-free planning and 24/7 support.
        </p>
      </div>

      <CTA />
    </section>
  );
}
