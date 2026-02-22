import { NextResponse } from "next/server";
import {
  createCustomPackageRequest,
  CreateCustomPackageRequestInput,
  validateCustomPackageInput,
} from "@/lib/backend/customPackageRequests";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateCustomPackageRequestInput;
    const validationError = validateCustomPackageInput(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const record = createCustomPackageRequest(body);
    return NextResponse.json({ request: record }, { status: 201 });
  } catch (error: unknown) {
    console.error("CUSTOM PACKAGE REQUEST CREATE ERROR:", error);
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
  }
}
