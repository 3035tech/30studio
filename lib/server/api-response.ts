import { NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS } from "@/lib/constants";
import { ApiError } from "@/lib/server/api-error";

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    { code: API_ERROR_CODES.internalError },
    { status: HTTP_STATUS.internalError, headers: { "Cache-Control": "no-store" } },
  );
}
