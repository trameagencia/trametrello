"use client";

import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buttonPrimary, inputBase } from "@/components/ui";

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
    <main className="flex min-h-screen flex-col bg-trame">
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <Image src="/trame-logo.png" alt="TRAME" width={308} height={67} priority className="mx-auto h-10 w-auto" />
          <div className="mt-10 rounded-3xl bg-white/90 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">Entrar</h1>
            <p className="mt-1 text-[15px] text-ink-2">Enviamos um link de acesso para o seu e-mail.</p>
            {status === "sent" ? (
              <p className="mt-6 rounded-2xl bg-[#34c759]/12 p-4 text-[15px] text-[#1a7f37]">
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
                  className={`${inputBase} w-full`}
                />
                <button disabled={status === "sending"} className={`${buttonPrimary} w-full py-2.5`}>
                  {status === "sending" ? "Enviando…" : "Receber link de acesso"}
                </button>
                {status === "error" && (
                  <p className="text-sm text-[#d70015]">Não foi possível enviar. Confira o e-mail e tente de novo.</p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
