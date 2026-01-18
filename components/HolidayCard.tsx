import Link from "next/link";

type Props = {
  title: string;
  description: string;
  slug: string;
};

export default function HolidayCard({ title, description, slug }: Props) {
  return (
    <div className="border rounded-lg p-6 hover:shadow-md transition">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>

      <Link
        href={`/holidays/${slug}`}
        className="text-primary font-medium hover:underline"
      >
        Get Best Price →
      </Link>
    </div>
  );
}
