import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { destinations as seedDestinations, packages as seedPackages } from "@/data/mockData";
import { Destination, Package } from "@/data/mockData";

interface CatalogData {
  packages: Package[];
  destinations: Destination[];
  updatedAt: string;
}

interface CatalogInput {
  packages?: Partial<Package>[];
  destinations?: Partial<Destination>[];
}

const runtimeDir = path.join(process.cwd(), ".runtime");
const catalogFile = path.join(runtimeDir, "catalog.json");

const allowedPackageTypes: Package["type"][] = [
  "family",
  "couple",
  "honeymoon",
  "adventure",
];

function nowIso(): string {
  return new Date().toISOString();
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePackage(input: Partial<Package>, index: number): Package {
  const destination = String(input.destination ?? "").trim();
  const title = String(input.title ?? "").trim() || `Package ${index + 1}`;
  const slug = toSlug(String(input.slug ?? title));
  const type = allowedPackageTypes.includes(input.type as Package["type"])
    ? (input.type as Package["type"])
    : "family";
  const price = Number(input.price ?? 0);

  return {
    id: String(input.id ?? crypto.randomUUID()),
    slug: slug || `package-${index + 1}`,
    title,
    destination: destination || "Destination",
    duration: String(input.duration ?? "4D/3N"),
    price: Number.isFinite(price) && price > 0 ? price : 10000,
    image: String(input.image ?? "/api/images/hero"),
    inclusions:
      Array.isArray(input.inclusions) && input.inclusions.length > 0
        ? input.inclusions.map((item) => String(item))
        : ["Flights", "Hotels"],
    type,
  };
}

function normalizeDestination(
  input: Partial<Destination>,
  index: number
): Destination {
  const name = String(input.name ?? "").trim() || `Destination ${index + 1}`;
  const packages = Number(input.packages ?? 0);

  return {
    id: String(input.id ?? crypto.randomUUID()),
    name,
    tagline: String(input.tagline ?? "Explore this destination"),
    image: String(input.image ?? "/api/images/hero"),
    packages: Number.isFinite(packages) && packages >= 0 ? packages : 0,
  };
}

function normalizeCatalog(input: CatalogInput): CatalogData {
  const normalizedPackages = Array.isArray(input.packages)
    ? input.packages.map((item, index) => normalizePackage(item, index))
    : [];

  const normalizedDestinations = Array.isArray(input.destinations)
    ? input.destinations.map((item, index) => normalizeDestination(item, index))
    : [];

  return {
    packages: normalizedPackages,
    destinations: normalizedDestinations,
    updatedAt: nowIso(),
  };
}

async function ensureCatalogFile(): Promise<void> {
  await fs.mkdir(runtimeDir, { recursive: true });
  try {
    await fs.access(catalogFile);
  } catch {
    const seeded: CatalogData = {
      packages: seedPackages,
      destinations: seedDestinations,
      updatedAt: nowIso(),
    };
    await fs.writeFile(catalogFile, JSON.stringify(seeded, null, 2), "utf8");
  }
}

export async function getCatalog(): Promise<CatalogData> {
  await ensureCatalogFile();
  const raw = await fs.readFile(catalogFile, "utf8");
  const parsed = JSON.parse(raw) as CatalogInput;
  return normalizeCatalog(parsed);
}

export async function saveCatalog(input: CatalogInput): Promise<CatalogData> {
  await ensureCatalogFile();
  const normalized = normalizeCatalog(input);
  await fs.writeFile(catalogFile, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}
