export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string, fields?: Record<string, string>) =>
  new HttpError(400, code, message, fields);
export const unauthorized = (message = "Authentication required") =>
  new HttpError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Forbidden") => new HttpError(403, "FORBIDDEN", message);
export const notFound = (message = "Not found") => new HttpError(404, "NOT_FOUND", message);
export const conflict = (message: string) => new HttpError(409, "CONFLICT", message);
