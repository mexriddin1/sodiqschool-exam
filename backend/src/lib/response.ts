import type { Response, NextFunction, Request } from "express";

export const ok = <T>(res: Response, data: T): void => {
  res.json({ success: true, data });
};

// Wrap an async handler so thrown errors flow to the error middleware.
export const asyncHandler =
  <Req extends Request = Request>(
    fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
  ) =>
  (req: Req, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
