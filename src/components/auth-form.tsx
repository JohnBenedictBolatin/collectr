"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { signIn, signUp, sendPasswordReset } from "@/lib/actions";
import { Cole } from "@/components/cole";

type Mode = "sign-in" | "sign-up" | "reset";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = mode === "sign-in" ? await signIn(form) : mode === "sign-up" ? await signUp(form) : await sendPasswordReset(form);
      if (result && "error" in result && result.error) setError(result.error);
      if (result && "message" in result && result.message) setMessage(result.message);
    } catch {
      setError("Something interrupted that request. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <main className="auth-page">
      <div className="auth-frame">
        <section className="auth-story" aria-label="Welcome to Collectr">
          <div className="brand-lockup"><span className="brand-mark"><span /></span><span>Collectr</span></div>
          <div className="auth-copy">
            <h1>Your collection.<br /><span>In its place.</span></h1>
            <p>A little home for everything you love to collect.</p>
            <div className="auth-tags"><span>Keep your catalog</span><span>Arrange your shelves</span><span>Find it again</span></div>
          </div>
          <Cole pose="welcome" className="auth-cole" />
          <div className="auth-floor"><span>Made for collectors, one shelf at a time.</span><span className="floor-stamp">PERSONAL / PRIVATE</span></div>
        </section>

        <section className="auth-panel">
          <div className="auth-form-wrap">
            <span className="auth-symbol" aria-hidden="true">{mode === "reset" ? <KeyRound /> : <Mail />}</span>
            <h2>{mode === "sign-in" ? "Welcome back" : mode === "sign-up" ? "Make yourself at home" : "Find your way back"}</h2>
            <p className="auth-subtitle">{mode === "sign-in" ? "Sign in to your personal collection." : mode === "sign-up" ? "Create a private space for your collection." : "We’ll email you a link to reset your password."}</p>

            <form className="auth-form" onSubmit={submit}>
              {mode === "sign-up" && <label>Display name<input name="displayName" autoComplete="name" maxLength={80} placeholder="What should we call you?" /></label>}
              <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label>
              {mode !== "reset" && <label>Password<span className="password-input"><input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required minLength={8} maxLength={128} placeholder="At least 8 characters" /><button className="icon-button password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>}
              {error && <p className="form-message error-message" role="alert">{error}</p>}
              {message && <p className="form-message success-message" role="status"><CheckCircle2 />{message}</p>}
              <button className="button button-primary button-wide" disabled={busy}>{busy ? "One moment…" : mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create my account" : "Send reset link"}<ArrowRight size={17} /></button>
            </form>

            <div className="auth-switches">
              {mode === "sign-in" ? <><button onClick={() => { setMode("reset"); setMessage(""); setError(""); }}>Forgot password?</button><span>New here? <button onClick={() => { setMode("sign-up"); setMessage(""); setError(""); }}>Create an account</button></span></> : <span>Already have an account? <button onClick={() => { setMode("sign-in"); setMessage(""); setError(""); }}>Sign in</button></span>}
            </div>
            <p className="private-note"><span className="privacy-dot" />Only you can see what you collect.</p>
          </div>
          <p className="auth-footnote">The things you collect are part of your story.<br />Keep them close.</p>
        </section>
      </div>
    </main>
  );
}
