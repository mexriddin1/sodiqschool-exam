import "dotenv/config";

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

export const config = {
  env: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  adminJwtSecret: required("ADMIN_JWT_SECRET", "dev-admin-secret-change-me"),
  resultJwtSecret: required("RESULT_JWT_SECRET", "dev-result-secret-change-me"),
  cookieSecure: process.env.COOKIE_SECURE === "true",
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:4321")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  adminTokenTtl: "7d",
  resultTokenTtl: "1d",
  bcryptCost: Number(process.env.BCRYPT_COST ?? 12),
} as const;

export const isProd = config.env === "production";
