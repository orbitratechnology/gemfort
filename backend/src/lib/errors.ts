import { HTTPException } from 'hono/http-exception';

/** Throw a 400 Bad Request with a descriptive message. */
export function badRequest(message: string): never {
  throw new HTTPException(400, { message });
}

/** Throw a 401 Unauthenticated. */
export function unauthenticated(message = 'Authentication required.'): never {
  throw new HTTPException(401, { message });
}

/** Throw a 403 Forbidden. */
export function forbidden(message = 'You do not have permission to perform this action.'): never {
  throw new HTTPException(403, { message });
}

/** Throw a 404 Not Found. */
export function notFound(message = 'Resource not found.'): never {
  throw new HTTPException(404, { message });
}

/** Throw a 409 Conflict. */
export function conflict(message: string): never {
  throw new HTTPException(409, { message });
}

/** Throw a 422 Unprocessable Entity. */
export function unprocessable(message: string): never {
  throw new HTTPException(422, { message });
}

/** Throw a 500 Internal Server Error. */
export function internal(message = 'An unexpected error occurred.'): never {
  throw new HTTPException(500, { message });
}

/** Re-usable shape for all error responses in the OpenAPI spec. */
export const errorSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'number' },
        message: { type: 'string' },
        details: { type: 'object', additionalProperties: true },
      },
    },
  },
} as const;
