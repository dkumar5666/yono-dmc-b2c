import { NextResponse } from "next/server";

export function routeError(status: 401 | 403 | 404 | 429 | 500, message: string) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}

