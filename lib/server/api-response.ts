import { NextResponse } from "next/server";
import { API_ERROR_CODES, HTTP_STATUS } from "@/lib/constants";
import { ApiError } from "@/lib/server/api-error";
import { logUnhandledRequestError } from "@/lib/server/operational-logger";

export function apiErrorResponse(error: unknown, request?: Request) {
  if (error instanceof ApiError) {
    if (error.status >= HTTP_STATUS.internalError && request) {
      const requestId = logUnhandledRequestError(error, request, "http.request.failed_expected_service_error");
      return NextResponse.json({ code: error.code, requestId }, { status: error.status, headers: { "Cache-Control": "no-store", "x-request-id": requestId } });
    }
    return NextResponse.json({ code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  }

  const requestId = request ? logUnhandledRequestError(error, request) : undefined;
  return NextResponse.json(
    { code: API_ERROR_CODES.internalError, ...(requestId ? { requestId } : {}) },
    { status: HTTP_STATUS.internalError, headers: { "Cache-Control": "no-store", ...(requestId ? { "x-request-id": requestId } : {}) } },
  );
}
