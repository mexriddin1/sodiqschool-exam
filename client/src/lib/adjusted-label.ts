// The "Tuzatilgan baho" (adjusted score) card shows raw + technicalLost +
// partialLost (see packages/compute/src/compute.ts:215). Its subtitle used to
// hard-code "e'tiborsizlik xatolarisiz" which was misleading when the extra
// marks came from partial answers, not from careless errors.
//
// This helper returns a subtitle that matches WHERE the recovered marks come
// from for the given report.

export function adjustedSubtitle(rep: {
  percent: number;
  adjusted: number;
  technicalLost: number;
  lostTotal: number;
  questions?: { result?: string; earned?: number; marks?: number; errorType?: string | null }[];
}): string {
  const partialLost = (rep.questions ?? [])
    .filter((q) => q.result === "Qisman" && q.errorType !== "Texnik")
    .reduce((s, q) => s + ((q.marks ?? 0) - (q.earned ?? 0)), 0);
  const hasTechnical = rep.technicalLost > 0;
  const hasPartial = partialLost > 0;

  if (rep.adjusted <= rep.percent) return "Xato yo'q — hozirgi daraja to'liq";
  if (hasTechnical && hasPartial) return "E'tiborsizlik xatolari va yarim javoblar tuzatilsa erishiladigan daraja";
  if (hasTechnical) return "E'tiborsizlik xatolari tuzatilsa erishiladigan daraja";
  if (hasPartial) return "Yarim javoblar tugallansa erishiladigan daraja";
  return "Xatolar tuzatilsa erishiladigan daraja";
}
