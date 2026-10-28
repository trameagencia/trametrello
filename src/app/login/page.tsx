"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">TRAME</h1>
        <p className="mt-1 text-sm text-slate-500">Entre com seu e-mail. Enviamos um link de acesso.</p>
        {status === "sent" ? (
          <p className="mt-6 rounded-md bg-teal-50 p-3 text-sm text-teal-800">
            Pronto! Abra o link que enviamos para <strong>{email}</strong>.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com.br"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
            <button
              disabled={status === "sending"}
              className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {status === "sending" ? "Enviando…" : "Receber link de acesso"}
            </button>
            {status === "error" && (
              <p className="text-sm text-red-600">Não foi possível enviar. Confira o e-mail e tente de novo.</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
