"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  displayName,
  positionBetween,
  type Attachment,
  type CardSummary,
  type ChecklistItem,
  type Column,
  type Comment,
  type Member,
  type Permissions,
} from "@/lib/types";
import { Avatar, LabelChip, LockIcon, formatDate, formatDateTime } from "./ui";

type Props = {
  card: CardSummary;
  columns: Column[];
  members: Member[];
  permissions: Permissions;
  currentUserId: string;
  onClose: () => void;
  onChanged: () => void;
};

export function CardModal({ card, columns, members, permissions, currentUserId, onClose, onChanged }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { canEdit, canComment, isTeam } = permissions;

  const fetchDetails = useCallback(async () => {
    const [i, c, a] = await Promise.all([
      supabase.from("checklist_items").select("*").eq("card_id", card.id).order("position"),
      supabase.from("comments").select("*").eq("card_id", card.id).order("created_at"),
      supabase.from("attachments").select("*").eq("card_id", card.id).order("created_at"),
    ]);
    return {
      items: (i.data ?? []) as ChecklistItem[],
      comments: (c.data ?? []) as Comment[],
      attachments: (a.data ?? []) as Attachment[],
    };
  }, [supabase, card.id]);

  const apply = useCallback((d: Awaited<ReturnType<typeof fetchDetails>>) => {
    setItems(d.items);
    setComments(d.comments);
    setAttachments(d.attachments);
  }, []);

  const load = useCallback(async () => apply(await fetchDetails()), [apply, fetchDetails]);

  // Recarrega quando o quadro recebe uma atualização (o objeto do cartão muda).
  useEffect(() => {
    let active = true;
    fetchDetails().then((d) => active && apply(d));
    return () => {
      active = false;
    };
  }, [fetchDetails, apply, card]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(promise: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await promise;
    if (error) setError(error.message);
    await load();
    onChanged();
  }

  const updateCard = (patch: Record<string, unknown>) => run(supabase.from("cards").update(patch).eq("id", card.id));

  const profileOf = (id: string | null) => members.find((m) => m.user_id === id)?.profile;
  const column = columns.find((c) => c.id === card.column_id);
  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-10" onMouseDown={onClose}>
      <div
        className="w-full max-w-3xl rounded-xl bg-slate-50 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div className="flex items-start gap-3 border-b border-slate-200 p-5">
          <div className="min-w-0 flex-1">
            <EditableText
              value={card.title}
              disabled={!canEdit}
              className="w-full text-lg font-semibold text-slate-900"
              onSave={(title) => title.trim() && updateCard({ title: title.trim() })}
            />
            <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              na coluna
              {canComment ? (
                <select
                  value={card.column_id}
                  onChange={(e) => run(supabase.rpc("move_card", { p_card: card.id, p_column: e.target.value, p_position: Date.now() }))}
                  className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-slate-800"
                >
                  {columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.team_only ? " (só equipe)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <strong className="text-slate-700">{column?.name}</strong>
              )}
              {column?.team_only && (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <LockIcon /> cliente não vê
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-xl leading-none text-slate-500 hover:bg-slate-200" aria-label="Fechar">
            ✕
          </button>
        </div>

        {error && (
          <p className="mx-5 mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700" onClick={() => setError(null)}>
            {error}
          </p>
        )}

        <div className="grid gap-6 p-5 md:grid-cols-[1fr_200px]">
          <div className="min-w-0 space-y-6">
            <Section title="Descrição">
              {canEdit ? (
                <EditableText
                  multiline
                  value={card.description}
                  placeholder="Adicione detalhes, briefing, links…"
                  className="min-h-20 w-full rounded-md border border-slate-200 bg-white p-2 text-sm"
                  onSave={(description) => updateCard({ description })}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap text-slate-700">{card.description || "Sem descrição."}</p>
              )}
            </Section>

            <Section title={`Peças a entregar ${items.length ? `(${doneCount}/${items.length})` : ""}`}>
              {items.length > 0 && (
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full ${doneCount === items.length ? "bg-green-500" : "bg-teal-600"}`}
                    style={{ width: `${(doneCount / items.length) * 100}%` }}
                  />
                </div>
              )}
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    members={members}
                    attachments={attachments.filter((a) => a.checklist_item_id === item.id)}
                    canEdit={canEdit}
                    canComment={canComment}
                    onToggle={(done) => run(supabase.rpc("toggle_checklist_item", { p_item: item.id, p_done: done }))}
                    onUpdate={(patch) => run(supabase.from("checklist_items").update(patch).eq("id", item.id))}
                    onDelete={() => run(supabase.from("checklist_items").delete().eq("id", item.id))}
                    onUpload={(file) => upload(file, item.id)}
                    onDownload={download}
                  />
                ))}
              </ul>
              {canEdit && (
                <AddInline
                  placeholder="Nova peça (ex.: Arte feed 1080x1350)"
                  button="Adicionar peça"
                  onAdd={(title) =>
                    run(
                      supabase.from("checklist_items").insert({
                        card_id: card.id,
                        title,
                        position: positionBetween(items[items.length - 1]?.position),
                      }),
                    )
                  }
                />
              )}
            </Section>

            <Section title="Anexos">
              <ul className="space-y-1">
                {attachments
                  .filter((a) => !a.checklist_item_id)
                  .map((a) => (
                    <AttachmentRow
                      key={a.id}
                      attachment={a}
                      canDelete={isTeam || a.uploaded_by === currentUserId}
                      onDownload={() => download(a)}
                      onDelete={() => removeAttachment(a)}
                    />
                  ))}
              </ul>
              {canComment && <UploadButton onFile={(f) => upload(f, null)} label="Anexar arquivo" />}
            </Section>

            <Section title="Comentários">
              {canComment && (
                <AddInline
                  multiline
                  placeholder="Escreva um comentário…"
                  button="Comentar"
                  onAdd={(body) => run(supabase.from("comments").insert({ card_id: card.id, author_id: currentUserId, body }))}
                />
              )}
              <ul className="mt-3 space-y-3">
                {[...comments].reverse().map((c) => (
                  <li key={c.id} className="flex gap-2">
                    <Avatar profile={profileOf(c.author_id)} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-slate-500">
                        <strong className="text-slate-800">{displayName(profileOf(c.author_id))}</strong> · {formatDateTime(c.created_at)}
                        {(c.author_id === currentUserId || isTeam) && (
                          <button
                            onClick={() => confirm("Apagar este comentário?") && run(supabase.from("comments").delete().eq("id", c.id))}
                            className="ml-2 text-slate-400 hover:text-red-600"
                          >
                            apagar
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 rounded-md bg-white p-2 text-sm whitespace-pre-wrap text-slate-800 ring-1 ring-slate-200">
                        {c.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          <aside className="space-y-5 text-sm">
            <Section title="Responsáveis">
              <div className="flex flex-wrap gap-1.5">
                {members
                  .filter((m) => card.assignee_ids.includes(m.user_id))
                  .map((m) => (
                    <span key={m.user_id} className="flex items-center gap-1">
                      <Avatar profile={m.profile} size="sm" /> {displayName(m.profile)}
                    </span>
                  ))}
              </div>
              {canEdit && (
                <select
                  value=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    run(
                      card.assignee_ids.includes(id)
                        ? supabase.from("card_assignees").delete().eq("card_id", card.id).eq("user_id", id)
                        : supabase.from("card_assignees").insert({ card_id: card.id, user_id: id }),
                    );
                  }}
                  className="mt-1.5 w-full rounded border border-slate-300 bg-white px-1.5 py-1"
                >
                  <option value="">Adicionar / remover…</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {card.assignee_ids.includes(m.user_id) ? "✓ " : ""}
                      {displayName(m.profile)}
                    </option>
                  ))}
                </select>
              )}
            </Section>

            <Section title="Entrega">
              {canEdit ? (
                <input
                  type="date"
                  value={card.due_date ?? ""}
                  onChange={(e) => updateCard({ due_date: e.target.value || null })}
                  className="w-full rounded border border-slate-300 bg-white px-1.5 py-1"
                />
              ) : (
                <span>{card.due_date ? formatDate(card.due_date) : "Sem data"}</span>
              )}
            </Section>

            <Section title="Etiquetas">
              <div className="flex flex-wrap gap-1">
                {card.labels.map((l) => (
                  <LabelChip
                    key={l}
                    label={l}
                    onRemove={canEdit ? () => updateCard({ labels: card.labels.filter((x) => x !== l) }) : undefined}
                  />
                ))}
              </div>
              {canEdit && (
                <AddInline
                  placeholder="Instagram, Reels…"
                  button="+"
                  compact
                  onAdd={(label) => !card.labels.includes(label) && updateCard({ labels: [...card.labels, label] })}
                />
              )}
            </Section>

            {canEdit && (
              <button
                onClick={async () => {
                  if (!confirm("Apagar este cartão?")) return;
                  await run(supabase.from("cards").delete().eq("id", card.id));
                  onClose();
                }}
                className="w-full rounded-md bg-red-50 px-3 py-1.5 text-red-700 hover:bg-red-100"
              >
                Apagar cartão
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );

  async function upload(file: File, checklistItemId: string | null) {
    const safeName = file.name.normalize("NFD").replace(/[^\w.\-]+/g, "_");
    const path = `${card.board_id}/${card.id}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
    if (error) return setError(error.message);
    await run(
      supabase.from("attachments").insert({
        card_id: card.id,
        checklist_item_id: checklistItemId,
        storage_path: path,
        name: file.name,
        size_bytes: file.size,
        mime_type: file.type || null,
        uploaded_by: currentUserId,
      }),
    );
  }

  async function download(a: Attachment) {
    const { data, error } = await supabase.storage.from("attachments").createSignedUrl(a.storage_path, 60, { download: a.name });
    if (error || !data) return setError(error?.message ?? "Não foi possível baixar");
    window.open(data.signedUrl, "_blank");
  }

  async function removeAttachment(a: Attachment) {
    if (!confirm(`Apagar o anexo "${a.name}"?`)) return;
    await supabase.storage.from("attachments").remove([a.storage_path]);
    await run(supabase.from("attachments").delete().eq("id", a.id));
  }
}

function ChecklistRow({
  item,
  members,
  attachments,
  canEdit,
  canComment,
  onToggle,
  onUpdate,
  onDelete,
  onUpload,
  onDownload,
}: {
  item: ChecklistItem;
  members: Member[];
  attachments: Attachment[];
  canEdit: boolean;
  canComment: boolean;
  onToggle: (done: boolean) => void;
  onUpdate: (patch: Partial<ChecklistItem>) => void;
  onDelete: () => void;
  onUpload: (file: File) => void;
  onDownload: (a: Attachment) => void;
}) {
  const assignee = members.find((m) => m.user_id === item.assignee_id);
  return (
    <li className="group rounded-md bg-white px-2 py-1.5 ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={item.done}
          disabled={!canComment}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 accent-teal-700"
        />
        <EditableText
          value={item.title}
          disabled={!canEdit}
          className={`min-w-0 flex-1 text-sm ${item.done ? "text-slate-400 line-through" : "text-slate-800"}`}
          onSave={(title) => title.trim() && onUpdate({ title: title.trim() })}
        />
        {canEdit && (
          <button onClick={onDelete} className="text-slate-300 hover:text-red-600 sm:invisible sm:group-hover:visible" aria-label="Remover peça">
            ✕
          </button>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 pl-6 text-xs text-slate-500">
        {canEdit ? (
          <>
            <select
              value={item.assignee_id ?? ""}
              onChange={(e) => onUpdate({ assignee_id: e.target.value || null })}
              className="rounded border border-slate-200 bg-white px-1 py-0.5"
            >
              <option value="">Sem responsável</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {displayName(m.profile)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={item.due_date ?? ""}
              onChange={(e) => onUpdate({ due_date: e.target.value || null })}
              className="rounded border border-slate-200 bg-white px-1 py-0.5"
            />
          </>
        ) : (
          <>
            {assignee && <span>{displayName(assignee.profile)}</span>}
            {item.due_date && <span>📅 {formatDate(item.due_date)}</span>}
          </>
        )}
        {attachments.map((a) => (
          <button key={a.id} onClick={() => onDownload(a)} className="truncate text-teal-700 hover:underline">
            📎 {a.name}
          </button>
        ))}
        {canComment && <UploadButton onFile={onUpload} label="anexar peça" small />}
      </div>
    </li>
  );
}

function AttachmentRow({
  attachment,
  canDelete,
  onDownload,
  onDelete,
}: {
  attachment: Attachment;
  canDelete: boolean;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-sm ring-1 ring-slate-200">
      <button onClick={onDownload} className="min-w-0 flex-1 truncate text-left text-teal-700 hover:underline">
        📎 {attachment.name}
      </button>
      <span className="text-xs text-slate-400">{formatDateTime(attachment.created_at)}</span>
      {canDelete && (
        <button onClick={onDelete} className="text-slate-300 hover:text-red-600" aria-label="Apagar anexo">
          ✕
        </button>
      )}
    </li>
  );
}

function UploadButton({ onFile, label, small }: { onFile: (f: File) => void; label: string; small?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={ref}
        type="file"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          await onFile(file);
          setBusy(false);
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className={
          small
            ? "text-slate-500 hover:text-teal-700"
            : "mt-2 rounded-md bg-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-300"
        }
      >
        {busy ? "Enviando…" : label}
      </button>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function EditableText({
  value,
  onSave,
  disabled,
  multiline,
  placeholder,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  disabled?: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(value);
  }
  const commit = () => draft !== value && onSave(draft);

  if (disabled) return <span className={className}>{value}</span>;
  return multiline ? (
    <textarea
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      rows={4}
      className={className}
    />
  ) : (
    <input
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={`rounded bg-transparent px-1 outline-none focus:bg-white focus:ring-1 focus:ring-teal-600 ${className ?? ""}`}
    />
  );
}

function AddInline({
  onAdd,
  placeholder,
  button,
  multiline,
  compact,
}: {
  onAdd: (text: string) => void;
  placeholder: string;
  button: string;
  multiline?: boolean;
  compact?: boolean;
}) {
  const [text, setText] = useState("");
  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  }
  return (
    <form onSubmit={submit} className={`mt-2 flex gap-2 ${multiline ? "flex-col items-start" : ""}`}>
      {multiline ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
        />
      ) : (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className={`min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm ${compact ? "text-xs" : ""}`}
        />
      )}
      <button className="rounded-md bg-teal-700 px-3 py-1 text-sm text-white hover:bg-teal-800">{button}</button>
    </form>
  );
}
