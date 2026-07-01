// Small SVG icon set used across the admin. Inline so they inherit currentColor
// and stay crisp. 18×18 default. Add the icon name to TYPE when you ship a new
// one.

import { SVGProps } from "react";

const STROKE = "1.6";

interface Props extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

type IconName =
  | "view"
  | "edit"
  | "delete"
  | "publish"
  | "unpublish"
  | "archive"
  | "key"
  | "plus"
  | "check"
  | "x"
  | "download"
  | "upload"
  | "copy"
  | "warning"
  | "save"
  | "filter"
  | "search"
  | "chevronDown"
  | "chevronUp"
  | "more"
  | "fileJson"
  | "refresh";

export function Icon({ name, size = 18, ...rest }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: STROKE,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
  switch (name) {
    case "view":
      return (
        <svg {...common}>
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "edit":
      return (
        <svg {...common}>
          <path d="M11 4H4v16h16v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
        </svg>
      );
    case "delete":
      return (
        <svg {...common}>
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      );
    case "publish":
      return (
        <svg {...common}>
          <path d="M5 12l5 5L20 7" />
        </svg>
      );
    case "unpublish":
      return (
        <svg {...common}>
          <path d="M3 12h18" />
        </svg>
      );
    case "archive":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="4" rx="1" />
          <path d="M5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7" />
          <path d="M9 12h6" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          <circle cx="8" cy="15" r="4" />
          <path d="M10.85 12.15 21 2l-3 3 3 3-4 4-3-3" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M5 12l5 5L20 7" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M12 21V9" />
          <path d="M7 14l5-5 5 5" />
          <path d="M5 3h14" />
        </svg>
      );
    case "copy":
      return (
        <svg {...common}>
          <rect x="8" y="8" width="13" height="13" rx="2" />
          <path d="M16 4H5a2 2 0 0 0-2 2v11" />
        </svg>
      );
    case "warning":
      return (
        <svg {...common}>
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      );
    case "save":
      return (
        <svg {...common}>
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
      );
    case "filter":
      return (
        <svg {...common}>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case "chevronDown":
      return (
        <svg {...common}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      );
    case "chevronUp":
      return (
        <svg {...common}>
          <polyline points="18 15 12 9 6 15" />
        </svg>
      );
    case "more":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "fileJson":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M10 13a2 2 0 0 0-2 2v3M14 13a2 2 0 0 1 2 2v3" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      );
  }
}

interface IconButtonProps {
  icon: IconName;
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "danger" | "primary";
  disabled?: boolean;
}

// A round icon button that exposes its label via title + aria-label.
export function IconButton({ icon, label, onClick, href, variant = "default", disabled }: IconButtonProps) {
  const base = "inline-flex items-center justify-center w-8 h-8 rounded-md transition disabled:opacity-40";
  const variants: Record<NonNullable<IconButtonProps["variant"]>, string> = {
    default: "text-gray-500 hover:bg-gray-100 hover:text-navy",
    danger: "text-bad hover:bg-bad/10",
    primary: "text-navy hover:bg-navy/10",
  };
  const cls = `${base} ${variants[variant]}`;
  if (href && !disabled) {
    return (
      <a href={href} title={label} aria-label={label} className={cls}>
        <Icon name={icon} />
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} className={cls}>
      <Icon name={icon} />
    </button>
  );
}
