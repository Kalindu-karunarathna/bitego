import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";

// Every API response uses one of two shapes:
//   success: { "data": ... }
//   error:   { "error": { "code": "SOME_CODE", "message": "Readable text", "details"?: ... } }

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status },
  );
}

function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

// Wrap every route handler with route(...). It turns thrown errors into the JSON error shape,
// so handlers can simply `throw new ApiError(...)` and never write try/catch themselves.
export function route<A extends unknown[]>(handler: (req: NextRequest, ...args: A) => Promise<Response>) {
  return async (req: NextRequest, ...args: A): Promise<Response> => {
    try {
      return await handler(req, ...args);
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err.status, err.code, err.message, err.details);
      if (err instanceof ZodError) {
        const details = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
        return errorResponse(400, "VALIDATION_ERROR", "Some fields are invalid", details);
      }
      if (isUniqueViolation(err)) {
        return errorResponse(409, "ALREADY_EXISTS", "A record with these details already exists");
      }
      console.error("Unhandled API error:", err);
      return errorResponse(500, "INTERNAL_ERROR", "Something went wrong");
    }
  };
}

// Reads the JSON body and validates it. Invalid input becomes a 400 response.
export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
  }
  return schema.parse(json);
}
