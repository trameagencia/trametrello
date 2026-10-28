"use client";

import { useActionState, useState } from "react";
import { inviteMember, type InviteState } from "./actions";

export function InviteForm({ boardId }: { boardId: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteMember.bind(null, boardId), null);
  const [kind, setKind] = useState("client");
  return (
    <form action={action} className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-medium text-slate-900">Convidar pessoa</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="email" type="email" required placeholder="email@cliente.com.br" className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
          <option value="client">Cliente</option>
          <option value="team">Equipe TRAME</option>
        </select>
        {kind === "client" && <AccessSelect />}
        <button disabled={pending} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60">
          {pending ? "Convidando…" : "Convidar"}
        </button>
      </div>
      {state && <p className={`text-sm ${state.ok ? "text-teal-700" : "text-red-600"}`}>{state.message}</p>}
    </form>
  );
}

export function AccessSelect({ defaultValue = "comment" }: { defaultValue?: string }) {
  return (
    <select name="access" defaultValue={defaultValue} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
      <option value="edit">Pode editar</option>
      <option value="comment">Comenta e move</option>
      <option value="view">Só vê</option>
    </select>
  );
}
