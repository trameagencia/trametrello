import { displayName, type Member, type Profile } from "@/lib/types";

// Etiquetas em tons suaves, como as tags do macOS.
const LABEL_STYLES = [
  "bg-[#e3f2ff] text-[#0060c0]",
  "bg-[#e6f6ea] text-[#1a7f37]",
  "bg-[#f3e8ff] text-[#7c3aed]",
  "bg-[#ffe8f1] text-[#c2185b]",
  "bg-[#fff1e0] text-[#b45309]",
  "bg-[#e0f7f5] text-[#0f766e]",
  "bg-[#ffeaea] text-[#c62828]",
  "bg-[#eef0ff] text-[#4338ca]",
];

const AVATAR_COLORS = ["#ff9f0a", "#30d158", "#0a84ff", "#bf5af2", "#ff375f", "#64d2ff", "#ac8e68", "#5e5ce6"];

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export const buttonPrimary =
  "inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black active:scale-[0.98] disabled:opacity-50";
export const buttonSecondary =
  "inline-flex items-center justify-center rounded-full bg-black/[0.05] px-4 py-2 text-sm font-medium text-ink transition hover:bg-black/[0.09] active:scale-[0.98] disabled:opacity-50";
export const buttonDanger =
  "inline-flex items-center justify-center rounded-full bg-[#ff3b30]/10 px-4 py-2 text-sm font-medium text-[#d70015] transition hover:bg-[#ff3b30]/15 disabled:opacity-50";
export const inputBase =
  "rounded-xl border border-line bg-white px-3 py-2 text-[15px] text-ink outline-none transition placeholder:text-ink-3 focus:border-accent focus:ring-4 focus:ring-accent/15";

export function LabelChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        LABEL_STYLES[hash(label) % LABEL_STYLES.length]
      }`}
    >
      {label}
      {onRemove && (
        <button onClick={onRemove} className="opacity-60 hover:opacity-100" aria-label={`Remover ${label}`}>
          ×
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
      style={{ backgroundColor: AVATAR_COLORS[hash(profile?.email ?? name) % AVATAR_COLORS.length] }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white ${
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs"
      }`}
    >
      {initials}
    </span>
  );
}

/** Círculo de concluído, no estilo do Trello / Lembretes. */
export function CheckCircle({
  checked,
  onChange,
  disabled,
  size = "md",
  label,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  label: string;
}) {
  const dim = size === "sm" ? "h-[18px] w-[18px]" : "h-5 w-5";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked);
      }}
      className={`${dim} inline-flex shrink-0 items-center justify-center rounded-full transition ${
        checked ? "bg-[#34c759] text-white" : "text-transparent ring-[1.5px] ring-ink-3/60 ring-inset hover:ring-ink-2"
      } ${disabled ? "cursor-default" : "cursor-pointer"}`}
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
        <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/** Texto com @menções destacadas (só nomes de membros do quadro). */
export function MentionText({ text, members }: { text: string; members: Member[] }) {
  const names = members.map((m) => displayName(m.profile)).sort((a, b) => b.length - a.length);
  if (!names.length || !text.includes("@")) return <>{text}</>;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(@(?:${escaped.join("|")}))`, "g"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="rounded-md bg-accent/10 px-1 font-medium text-accent">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** IDs dos membros mencionados com @Nome no texto. */
export function mentionedIds(text: string, members: Member[]) {
  return members.filter((m) => text.includes(`@${displayName(m.profile)}`)).map((m) => m.user_id);
}

export function formatDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
