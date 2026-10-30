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
import { MentionInput } from "./MentionInput";
import {
  Avatar,
  CheckCircle,
  LabelChip,
  LockIcon,
  MentionText,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  formatDate,
  formatDateTime,
  inputBase,
  mentionedIds,
} from "./ui";

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
  const archived = !!card.archived_at;
  const completed = !!card.completed_at;

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
  const topItems = items.filter((i) => !i.parent_id);
  const childrenOf = (id: string) => items.filter((i) => i.parent_id === id);

  function addItem(title: string, parentId: string | null) {
    const siblings = items.filter((i) => i.parent_id === parentId);
    return run(
      supabase.from("checklist_items").insert({
        card_id: card.id,
        parent_id: parentId,
        title,
        position: positionBetween(siblings[siblings.length - 1]?.position),
      }),
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/25 p-3 backdrop-blur-sm sm:p-10"
      onMouseDown={onClose}
    >
      <div
        className="animate-sheet w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.25)]"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        {archived && (
          <div className="flex items-center gap-3 bg-[#fff6cc] px-6 py-2.5 text-sm text-[#7a5d00]">
            <span className="flex-1">Este cartão está arquivado e não aparece no quadro.</span>
            {canEdit && (
              <button onClick={() => updateCard({ archived_at: null })} className="font-medium underline">
                Restaurar
              </button>
            )}
          </div>
        )}

        <div className="flex items-start gap-3 px-6 pt-6 pb-4">
          <span className="mt-1.5">
            <CheckCircle
              checked={completed}
              disabled={!canComment}
              onChange={(done) => run(supabase.rpc("set_card_completed", { p_card: card.id, p_done: done }))}
              label={completed ? "Marcar como não concluído" : "Marcar como concluído"}
            />
          </span>
          <div className="min-w-0 flex-1">
            <EditableText
              value={card.title}
              disabled={!canEdit}
              className="w-full text-[22px] leading-tight font-semibold tracking-tight text-ink"
              onSave={(title) => title.trim() && updateCard({ title: title.trim() })}
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-ink-2">
              {completed && <span className="rounded-full bg-[#34c759]/15 px-2 py-0.5 text-xs font-medium text-[#1a7f37]">Concluído</span>}
              <span>na coluna</span>
              {canComment && !archived ? (
                <select
                  value={card.column_id}
                  onChange={(e) => run(supabase.rpc("move_card", { p_card: card.id, p_column: e.target.value, p_position: Date.now() }))}
                  className="rounded-lg bg-black/[0.05] px-2 py-0.5 font-medium text-ink outline-none"
                >
                  {columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.team_only ? " (só equipe)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <strong className="font-medium text-ink">{column?.name}</strong>
              )}
              {column?.team_only && (
                <span className="inline-flex items-center gap-1 text-[#8a6d00]">
                  <LockIcon /> cliente não vê
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-ink-2 transition hover:bg-black/5 hover:text-ink" aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {error && (
          <p className="mx-6 mb-2 rounded-xl bg-[#ff3b30]/10 px-3 py-2 text-sm text-[#d70015]" onClick={() => setError(null)}>
            {error}
          </p>
        )}

        <div className="grid gap-8 px-6 pb-6 md:grid-cols-[1fr_210px]">
          <div className="min-w-0 space-y-7">
            <Section title="Descrição">
              {canEdit ? (
                <DescriptionEditor value={card.description} members={members} onSave={(description) => updateCard({ description })} />
              ) : (
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink">
                  {card.description ? <MentionText text={card.description} members={members} /> : <span className="text-ink-3">Sem descrição.</span>}
                </p>
              )}
            </Section>

            <Section title="Peças a entregar" aside={items.length ? `${doneCount} de ${items.length}` : undefined}>
              {items.length > 0 && (
                <div className="mb-3 h-1 overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className={`h-full rounded-full transition-all ${doneCount === items.length ? "bg-[#34c759]" : "bg-accent"}`}
                    style={{ width: `${(doneCount / items.length) * 100}%` }}
                  />
                </div>
              )}
              <ul className="space-y-1">
                {topItems.map((item) => (
                  <li key={item.id}>
                    <ChecklistRow
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
                      onAddSub={canEdit ? (title) => addItem(title, item.id) : undefined}
                    />
                    {childrenOf(item.id).length > 0 && (
                      <ul className="ml-7 space-y-1 border-l border-line pl-3">
                        {childrenOf(item.id).map((sub) => (
                          <li key={sub.id}>
                            <ChecklistRow
                              item={sub}
                              members={members}
                              attachments={attachments.filter((a) => a.checklist_item_id === sub.id)}
                              canEdit={canEdit}
                              canComment={canComment}
                              small
                              onToggle={(done) => run(supabase.rpc("toggle_checklist_item", { p_item: sub.id, p_done: done }))}
                              onUpdate={(patch) => run(supabase.from("checklist_items").update(patch).eq("id", sub.id))}
                              onDelete={() => run(supabase.from("checklist_items").delete().eq("id", sub.id))}
                              onUpload={(file) => upload(file, sub.id)}
                              onDownload={download}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
              {canEdit && <AddInline placeholder="Nova peça (ex.: Arte feed 1080×1350)" button="Adicionar" onAdd={(title) => addItem(title, null)} />}
            </Section>

            <Section title="Anexos">
              <ul className="space-y-1.5">
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
                <CommentComposer
                  members={members}
                  onSubmit={(body) =>
                    run(
                      supabase.from("comments").insert({
                        card_id: card.id,
                        author_id: currentUserId,
                        body,
                        mentions: mentionedIds(body, members),
                      }),
                    )
                  }
                />
              )}
              <ul className="mt-4 space-y-4">
                {[...comments].reverse().map((c) => (
                  <li key={c.id} className="flex gap-2.5">
                    <Avatar profile={profileOf(c.author_id)} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-ink-3">
                        <strong className="font-semibold text-ink">{displayName(profileOf(c.author_id))}</strong>
                        <span className="ml-1.5">{formatDateTime(c.created_at)}</span>
                        {(c.author_id === currentUserId || isTeam) && (
                          <button
                            onClick={() => confirm("Apagar este comentário?") && run(supabase.from("comments").delete().eq("id", c.id))}
                            className="ml-2 hover:text-[#d70015]"
                          >
                            Apagar
                          </button>
                        )}
                      </div>
                      <p className="mt-1 rounded-2xl rounded-tl-md bg-black/[0.04] px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-ink">
                        <MentionText text={c.body} members={members} />
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          <aside className="space-y-6 text-sm">
            <Section title="Responsáveis">
              <div className="flex flex-col gap-1.5">
                {members
                  .filter((m) => card.assignee_ids.includes(m.user_id))
                  .map((m) => (
                    <span key={m.user_id} className="flex items-center gap-2 text-ink">
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
                  className="mt-2 w-full rounded-lg bg-black/[0.05] px-2 py-1.5 text-ink outline-none"
                >
                  <option value="">Adicionar ou remover…</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {card.assignee_ids.includes(m.user_id) ? "✓ " : ""}
                      {displayName(m.profile)}
                    </option>
                  ))}
                </select>
              )}
            </Section>

            <Section title="Datas">
              <div className="space-y-2">
                <DateField
                  label="Criação"
                  hint="quando a equipe produz"
                  value={card.start_date}
                  disabled={!canEdit}
                  onChange={(v) => updateCard({ start_date: v })}
                />
                <DateField
                  label="Deadline do cliente"
                  value={card.due_date}
                  disabled={!canEdit}
                  onChange={(v) => updateCard({ due_date: v })}
                />
              </div>
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
              <Section title="Ações">
                <div className="flex flex-col gap-2">
                  {archived ? (
                    <button onClick={() => updateCard({ archived_at: null })} className={buttonSecondary}>
                      Restaurar
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        await updateCard({ archived_at: new Date().toISOString() });
                        onClose();
                      }}
                      className={buttonSecondary}
                    >
                      Arquivar
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (!confirm("Excluir de vez este cartão? Isso não pode ser desfeito. Para guardar o histórico, use Arquivar.")) return;
                      await run(supabase.from("cards").delete().eq("id", card.id));
                      onClose();
                    }}
                    className={buttonDanger}
                  >
                    Excluir
                  </button>
                </div>
              </Section>
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

function DateField({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | null;
  disabled: boolean;
  onChange: (v: string | null) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-ink-2">
        {label}
        {hint && <span className="text-ink-3"> · {hint}</span>}
      </span>
      {disabled ? (
        <span className="mt-0.5 block text-ink">{value ? formatDate(value) : "Sem data"}</span>
      ) : (
        <input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="mt-0.5 w-full rounded-lg bg-black/[0.05] px-2 py-1.5 text-ink outline-none"
        />
      )}
    </label>
  );
}

function DescriptionEditor({ value, members, onSave }: { value: string; members: Member[]; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(value);
  }
  return (
    <MentionInput
      value={draft}
      onChange={setDraft}
      members={members}
      rows={4}
      placeholder="Adicione detalhes, briefing, links… Use @ para mencionar alguém."
      onBlur={() => draft !== value && onSave(draft)}
      className={`${inputBase} min-h-24 w-full resize-y leading-relaxed`}
    />
  );
}

function CommentComposer({ members, onSubmit }: { members: Member[]; onSubmit: (body: string) => void }) {
  const [text, setText] = useState("");
  function submit() {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText("");
  }
  return (
    <div>
      <MentionInput
        value={text}
        onChange={setText}
        members={members}
        rows={2}
        placeholder="Escreva um comentário… Use @ para mencionar."
        onSubmit={submit}
        className={`${inputBase} w-full resize-y`}
      />
      {text.trim() && (
        <div className="mt-2 flex items-center gap-3">
          <button onClick={submit} className={`${buttonPrimary} py-1.5`}>
            Comentar
          </button>
          <span className="text-xs text-ink-3">⌘ + Enter para enviar</span>
        </div>
      )}
    </div>
  );
}

function ChecklistRow({
  item,
  members,
  attachments,
  canEdit,
  canComment,
  small,
  onToggle,
  onUpdate,
  onDelete,
  onUpload,
  onDownload,
  onAddSub,
}: {
  item: ChecklistItem;
  members: Member[];
  attachments: Attachment[];
  canEdit: boolean;
  canComment: boolean;
  small?: boolean;
  onToggle: (done: boolean) => void;
  onUpdate: (patch: Partial<ChecklistItem>) => void;
  onDelete: () => void;
  onUpload: (file: File) => void;
  onDownload: (a: Attachment) => void;
  onAddSub?: (title: string) => void;
}) {
  const assignee = members.find((m) => m.user_id === item.assignee_id);
  const [addingSub, setAddingSub] = useState(false);
  const [details, setDetails] = useState(false);
  return (
    <div className="group rounded-xl px-2 py-1.5 transition hover:bg-black/[0.03]">
      <div className="flex items-center gap-2.5">
        <CheckCircle
          size="sm"
          checked={item.done}
          disabled={!canComment}
          onChange={onToggle}
          label={item.done ? "Desmarcar peça" : "Marcar peça como pronta"}
        />
        <EditableText
          value={item.title}
          disabled={!canEdit}
          className={`min-w-0 flex-1 ${small ? "text-sm" : "text-[15px]"} ${item.done ? "text-ink-3 line-through" : "text-ink"}`}
          onSave={(title) => title.trim() && onUpdate({ title: title.trim() })}
        />
        {assignee && <Avatar profile={assignee.profile} size="sm" />}
        {item.due_date && <span className="text-xs text-ink-2">{formatDate(item.due_date)}</span>}
        {attachments.length > 0 && <span className="text-xs text-ink-2">📎 {attachments.length}</span>}
        <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          {(canEdit || canComment) && (
            <button
              onClick={() => setDetails((v) => !v)}
              className="rounded-full px-2 py-0.5 text-xs text-ink-2 hover:bg-black/5 hover:text-ink"
              aria-label="Detalhes da peça"
            >
              •••
            </button>
          )}
          {canEdit && (
            <button onClick={onDelete} className="rounded-full px-1.5 text-ink-3 hover:text-[#d70015]" aria-label="Remover">
              ×
            </button>
          )}
        </div>
      </div>
      {details && (
        <div className="mt-2 ml-7 flex flex-wrap items-center gap-2 text-xs text-ink-2">
          {canEdit ? (
            <>
              <select
                value={item.assignee_id ?? ""}
                onChange={(e) => onUpdate({ assignee_id: e.target.value || null })}
                className="rounded-lg bg-black/[0.05] px-2 py-1 outline-none"
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
                className="rounded-lg bg-black/[0.05] px-2 py-1 outline-none"
              />
            </>
          ) : (
            assignee && <span>{displayName(assignee.profile)}</span>
          )}
          {attachments.map((a) => (
            <button key={a.id} onClick={() => onDownload(a)} className="max-w-48 truncate text-accent hover:underline">
              📎 {a.name}
            </button>
          ))}
          {canComment && <UploadButton onFile={onUpload} label="Anexar peça" small />}
          {onAddSub && (
            <button onClick={() => setAddingSub(true)} className="text-accent hover:underline">
              + Sub-item
            </button>
          )}
        </div>
      )}
      {addingSub && onAddSub && (
        <div className="ml-7">
          <AddInline
            autoFocus
            placeholder="Novo sub-item"
            button="Adicionar"
            onAdd={(title) => {
              onAddSub(title);
            }}
            onCancel={() => setAddingSub(false)}
          />
        </div>
      )}
    </div>
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
    <li className="flex items-center gap-2 rounded-xl bg-black/[0.03] px-3 py-2 text-sm">
      <button onClick={onDownload} className="min-w-0 flex-1 truncate text-left text-accent hover:underline">
        📎 {attachment.name}
      </button>
      <span className="text-xs text-ink-3">{formatDateTime(attachment.created_at)}</span>
      {canDelete && (
        <button onClick={onDelete} className="text-ink-3 hover:text-[#d70015]" aria-label="Apagar anexo">
          ×
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
        className={small ? "text-accent hover:underline" : `${buttonSecondary} mt-2.5 py-1.5`}
      >
        {busy ? "Enviando…" : label}
      </button>
    </>
  );
}

function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold text-ink-2">{title}</h3>
        {aside && <span className="text-xs text-ink-3 tabular-nums">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function EditableText({
  value,
  onSave,
  disabled,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  disabled?: boolean;
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
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={`-mx-1 rounded-lg bg-transparent px-1 outline-none focus:bg-black/[0.03] focus:ring-4 focus:ring-accent/15 ${className ?? ""}`}
    />
  );
}

function AddInline({
  onAdd,
  onCancel,
  placeholder,
  button,
  compact,
  autoFocus,
}: {
  onAdd: (text: string) => void;
  onCancel?: () => void;
  placeholder: string;
  button: string;
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  }
  return (
    <form onSubmit={submit} className="mt-2 flex gap-2">
      <input
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel?.()}
        placeholder={placeholder}
        className={`${inputBase} min-w-0 flex-1 ${compact ? "px-2.5 py-1 text-xs" : "py-1.5 text-sm"}`}
      />
      <button className={`${buttonPrimary} ${compact ? "px-3 py-1 text-xs" : "py-1.5"}`}>{button}</button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="text-sm text-ink-2 hover:text-ink">
          Cancelar
        </button>
      )}
    </form>
  );
}
