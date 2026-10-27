"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound } from "lucide-react";
import { updatePassword } from "@/lib/actions";

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const result = await updatePassword(new FormData(event.currentTarget));
      if (result && "error" in result) setError(result.error);
      else router.push("/");
    } catch { setError("That reset link may have expired. Request a fresh one and try again."); }
    finally { setBusy(false); }
  }
  return <main className="reset-page"><section className="reset-card"><span className="auth-symbol"><KeyRound /></span><h1>Choose a new password</h1><p>Use at least eight characters. Then sign in with your new password.</p><form className="auth-form" onSubmit={save}><label>New password<input name="password" type="password" minLength={8} maxLength={128} required autoComplete="new-password" /></label>{error && <p className="form-message error-message" role="alert">{error}</p>}<button className="button button-primary button-wide" disabled={busy}><Check />{busy ? "Saving…" : "Update password"}</button></form></section></main>;
}
