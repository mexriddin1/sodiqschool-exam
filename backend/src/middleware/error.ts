import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/errors.js";
import { isProd } from "../config.js";

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        fields: Object.fromEntries(err.issues.map((i) => [i.path.join("."), i.message])),
      },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, fields: err.fields ?? {} },
    });
    return;
  }
  console.error("[unhandled]", err);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: isProd ? "Internal server error" : (err as Error)?.message ?? "Internal error",
    },
  });
};
