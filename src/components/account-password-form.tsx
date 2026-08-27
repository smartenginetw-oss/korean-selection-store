"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./account-password-form.module.css";

export function AccountPasswordForm() {
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (password.length < 8) {
      setError("新密碼至少需要 8 碼。");
      return;
    }
    if (password !== confirmation) {
      setError("兩次輸入的密碼不一致。");
      return;
    }

    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("密碼更新失敗，請稍後再試或重新登入。");
    } else {
      setPassword("");
      setConfirmation("");
      setMessage("密碼已更新，下次登入請使用新密碼。");
    }
    setPending(false);
  }

  return <form className={styles.form} onSubmit={handleSubmit}>
    <div className={styles.fields}>
      <div className="field">
        <label htmlFor="account-new-password">新密碼</label>
        <input className="input" id="account-new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
      </div>
      <div className="field">
        <label htmlFor="account-confirm-password">確認新密碼</label>
        <input className="input" id="account-confirm-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={8} required />
      </div>
    </div>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {message && <div className={styles.message} role="status">{message}</div>}
    <button className="button button-secondary button-small" type="submit" disabled={pending}>{pending ? "更新中…" : "更新密碼"}</button>
  </form>;
}
