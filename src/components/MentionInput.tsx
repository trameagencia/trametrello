"use client";

import { useRef, useState } from "react";
import { displayName, type Member } from "@/lib/types";
import { Avatar } from "./ui";

type Props = {
  value: string;
  onChange: (v: string) => void;
  members: Member[];
  placeholder?: string;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  onSubmit?: () => void;
};

/** Caixa de texto que sugere membros ao digitar @. */
export function MentionInput({ value, onChange, members, placeholder, rows = 3, className, autoFocus, onBlur, onSubmit }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null);
  const [active, setActive] = useState(0);

  const matches = query
    ? members
        .filter((m) => {
          const q = query.text.toLowerCase();
          return displayName(m.profile).toLowerCase().includes(q) || m.profile.email.toLowerCase().startsWith(q);
        })
        .slice(0, 6)
    : [];

  function detect(text: string, caret: number) {
    const before = text.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at < 0 || (at > 0 && !/\s/.test(before[at - 1]))) return setQuery(null);
    const typed = before.slice(at + 1);
    if (typed.length > 30 || /\n/.test(typed)) return setQuery(null);
    setQuery({ start: at, text: typed });
    setActive(0);
  }

  function pick(m: Member) {
    if (!query || !ref.current) return;
    const caret = ref.current.selectionStart;
    const name = `@${displayName(m.profile)} `;
    const next = value.slice(0, query.start) + name + value.slice(caret);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = query.start + name.length;
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (matches.length) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % matches.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + matches.length) % matches.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              pick(matches[active]);
              return;
            }
            if (e.key === "Escape") {
              setQuery(null);
              return;
            }
          }
          if (onSubmit && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        onBlur={() => {
          setTimeout(() => setQuery(null), 150);
          onBlur?.();
        }}
        className={className}
      />
      {matches.length > 0 && (
        <ul className="absolute left-2 z-30 mt-1 w-64 overflow-hidden rounded-xl border border-line bg-white/95 py-1 shadow-xl backdrop-blur">
          {matches.map((m, i) => (
            <li key={m.user_id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(m);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === active ? "bg-accent text-white" : "text-ink"}`}
              >
                <Avatar profile={m.profile} size="sm" />
                <span className="min-w-0 flex-1 truncate">{displayName(m.profile)}</span>
                <span className={`text-xs ${i === active ? "text-white/80" : "text-ink-3"}`}>
                  {m.kind === "team" ? "Equipe" : "Cliente"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
