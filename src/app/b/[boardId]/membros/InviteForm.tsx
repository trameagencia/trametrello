"use client";
import { useActionState, useState } from "react";
import { inviteMember, type InviteState } from "./actions";
import { buttonPrimary, inputBase } from "@/components/ui";

export function InviteForm({ boardId }: { boardId: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteMember.bind(null, boardId), null);
  const [kind, setKind] = useState("client");
  return (
    <form action={action} className="space-y-2 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_0.5px_rgba(0,0,0,0.05)]">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">Convidar pessoa</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="email" type="email" required placeholder="email@cliente.com.br" className={`flex-1 ${inputBase}`} />
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-xl bg-black/[0.05] px-3 py-2 text-sm outline-none">
          <option value="client">Cliente</option>
          <option value="team">Equipe TRAME</option>
        </select>
        {kind === "client" && <AccessSelect />}
        <button disabled={pending} className={`${buttonPrimary}`}>
          {pending ? "Convidando…" : "Convidar"}
        </button>
      </div>
      {state && <p className={`text-sm ${state.ok ? "text-[#1a7f37]" : "text-[#d70015]"}`}>{state.message}</p>}
    </form>
  );
}

export function AccessSelect({ defaultValue = "comment" }: { defaultValue?: string }) {
  return (
    <select name="access" defaultValue={defaultValue} className="rounded-xl bg-black/[0.05] px-3 py-2 text-sm outline-none">
      <option value="edit">Pode editar</option>
      <option value="comment">Comenta e move</option>
      <option value="view">Só vê</option>
    </select>
  );
}
