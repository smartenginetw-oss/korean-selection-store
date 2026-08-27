"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCanonicalAuthOrigin } from "@/lib/site";
import styles from "@/app/auth-page.module.css";

export function ForgotPasswordForm({ audience, nextPath }: { audience: "member" | "admin"; nextPath: string }) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");
    const redirectTo = `${getCanonicalAuthOrigin(audience)}/reset-password?audience=${audience}&next=${encodeURIComponent(nextPath)}`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (resetError) {
      setError("目前無法寄出重設信，請稍後再試。");
    } else {
      setMessage("如果這個 Email 已註冊，重設密碼連結會寄到信箱；也請檢查垃圾郵件。");
    }
    setPending(false);
  }

  return <form className={styles.form} onSubmit={handleSubmit}>
    <div className="field"><label htmlFor={`${audience}-forgot-email`}>Email</label><input className="input" id={`${audience}-forgot-email`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={254} /></div>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {message && <div className={styles.message} role="status">{message}</div>}
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? "寄送中…" : "寄出重設連結"}</button>
  </form>;
}
