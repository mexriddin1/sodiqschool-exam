export type ResultStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

const STYLE: Record<ResultStatus, string> = {
  DRAFT: "bg-gray-200 text-gray-700",
  PUBLISHED: "bg-good text-white",
  ARCHIVED: "bg-warn text-white",
};

const LABEL: Record<ResultStatus, string> = {
  DRAFT: "Qoralama",
  PUBLISHED: "Nashr etilgan",
  ARCHIVED: "Arxiv",
};

export function StatusBadge({ status }: { status: ResultStatus }) {
  return <span className={`badge ${STYLE[status]}`}>{LABEL[status]}</span>;
}
