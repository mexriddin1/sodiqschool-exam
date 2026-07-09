import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { config } from "./config.js";
import { errorMiddleware } from "./middleware/error.js";
import { adminAuthRouter } from "./routes/admin.auth.js";
import { studentsRouter } from "./routes/admin.students.js";
import { examsRouter } from "./routes/admin.exams.js";
import { resultsRouter } from "./routes/admin.results.js";
import { publicResultRouter } from "./routes/public.result.js";
import { adminUsersRouter } from "./routes/admin.users.js";
import { auditRouter } from "./routes/admin.audit.js";
import { templatesRouter } from "./routes/admin.templates.js";
import { testTemplatesRouter } from "./routes/admin.testtemplates.js";
import { statsRouter } from "./routes/admin.stats.js";
import { subjectsRouter } from "./routes/admin.subjects.js";
import { settingsRouter } from "./routes/admin.settings.js";
import { publicConfigRouter } from "./routes/public.config.js";

const app = express();

// Behind nginx: honour X-Forwarded-For / X-Forwarded-Proto exactly one hop
// deep so the rate-limiter, cookie `secure`, and req.ip see the real client
// address instead of 127.0.0.1. Without this, express-rate-limit throws
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR and every login gets rejected.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  }),
);
// 5 MB covers the largest exam-results CSV we've seen (~300 rows x 95 cols).
// If it grows further, switch admin.results/import-csv to multipart file upload.
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Generic admin rate limit; tighten login separately if abuse appears.
const adminLimiter = rateLimit({ windowMs: 60_000, max: 240 });
app.use("/api/admin", adminLimiter);

app.use("/api/admin/auth", adminAuthRouter);
app.use("/api/admin/students", studentsRouter);
app.use("/api/admin/exams", examsRouter);
app.use("/api/admin/results", resultsRouter);
app.use("/api/admin/users", adminUsersRouter);
app.use("/api/admin/audit-logs", auditRouter);
app.use("/api/admin/templates", templatesRouter);
app.use("/api/admin/test-templates", testTemplatesRouter);
app.use("/api/admin/stats", statsRouter);
app.use("/api/admin/subjects", subjectsRouter);
app.use("/api/admin/settings", settingsRouter);
app.use("/api/result", publicResultRouter);
app.use("/api/public", publicConfigRouter);

app.use(errorMiddleware);

app.listen(config.port, () => {
  console.log(`[backend] http://localhost:${config.port} (env=${config.env})`);
});
