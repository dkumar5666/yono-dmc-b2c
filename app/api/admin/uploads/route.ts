import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { requireRoles } from "@/lib/backend/adminAuth";

export const runtime = "nodejs";

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "bin";
}

export async function POST(req: Request) {
  try {
    const authError = requireRoles(req, ["admin", "editor"]);
    if (authError) return authError;

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    if (!mimeType.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = extensionForMime(mimeType);
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const absolutePath = path.join(uploadDir, filename);
    await fs.writeFile(absolutePath, bytes);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (error: unknown) {
    console.error("IMAGE UPLOAD ERROR:", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
