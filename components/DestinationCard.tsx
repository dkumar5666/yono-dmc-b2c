import Image from "next/image";
import Link from "next/link";

type Props = {
  title: string;
  slug: string;
  image: string;
};

export default function DestinationCard({ title, slug, image }: Props) {
  return (
    <div className="rounded-xl overflow-hidden shadow hover:shadow-lg transition bg-white">
      <div className="relative h-48">
        <Image
          src={image}
          alt={`${title} Holiday Packages`}
          fill
          className="object-cover"
        />
      </div>

      <div className="p-5">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>

        <Link
          href={`/holidays/${slug}`}
          className="text-primary font-medium"
        >
          View Packages →
        </Link>
      </div>
    </div>
  );
}
