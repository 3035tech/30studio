import type { Instrumentation } from "next";
import { logOperationalError } from "@/lib/server/operational-logger";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  logOperationalError("next.request.unhandled_error", error, {
    method: request.method,
    path: request.path.split("?", 1)[0],
    route: context.routePath,
    routeType: context.routeType,
    router: context.routerKind,
  });
};
