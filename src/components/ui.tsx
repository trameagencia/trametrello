import { displayName, type Profile } from "@/lib/types";

const LABEL_COLORS = [
  "bg-teal-600",
  "bg-sky-600",
  "bg-violet-600",
  "bg-pink-600",
  "bg-orange-500",
  "bg-lime-600",
  "bg-rose-600",
  "bg-indigo-600",
];

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function LabelChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-white ${
        LABEL_COLORS[hash(label) % LABEL_COLORS.length]
      }`}
    >
      {label}
      {onRemove && (
        <button onClick={onRemove} className="opacity-70 hover:opacity-100" aria-label={`Remover ${label}`}>
          ✕
        </button>
      )}
    </span>
  );
}

export function Avatar({
  profile,
  size = "md",
}: {
  profile: Pick<Profile, "email" | "full_name"> | null | undefined;
  size?: "sm" | "md";
}) {
  const name = displayName(profile);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-slate-700 font-medium text-white ring-2 ring-white ${
        size === "sm" ? "h-5 w-5 text-[9px]" : "h-8 w-8 text-xs"
      }`}
    >
      {initials}
    </span>
  );
}

export function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function formatDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
