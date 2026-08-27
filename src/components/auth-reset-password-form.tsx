"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/auth-page.module.css";

export function ResetPasswordForm() {
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
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
      setError("重設密碼失敗，請重新從 Email 開啟連結。");
    } else {
      setMessage("密碼已更新，請返回登入頁使用新密碼登入。");
      await supabase.auth.signOut();
    }
    setPending(false);
  }

  if (ready === null) return <p className={styles.intro}>正在確認重設連結…</p>;
  if (!ready) return <div className={styles.error} role="alert">這個重設連結已失效或尚未開啟，請回到「忘記密碼」重新寄送。</div>;

  return <form className={styles.form} onSubmit={handleSubmit}>
    <div className="field"><label htmlFor="new-password">新密碼</label><input className="input" id="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></div>
    <div className="field"><label htmlFor="confirm-password">確認新密碼</label><input className="input" id="confirm-password" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={8} required /></div>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {message && <div className={styles.message} role="status">{message}</div>}
    <button className="button button-primary" type="submit" disabled={pending || Boolean(message)}>{pending ? "更新中…" : "更新密碼"}</button>
  </form>;
}
