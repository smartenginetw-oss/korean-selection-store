"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import styles from "./auth-register-form.module.css";

export function AuthRegisterForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() } },
    });

    if (error || !data.user) {
      setErrorMessage("目前無法建立會員，請確認 Email 尚未註冊，或稍後再試。");
      setPending(false);
      return;
    }

    if (data.session) {
      router.replace(nextPath);
      router.refresh();
      return;
    }

    setSuccessMessage("註冊完成，請到 Email 收取確認信，再回到會員登入。 ");
    setPending(false);
  }

  return <form className={styles.form} onSubmit={handleSubmit}>
    <div className="field"><label htmlFor="register-name">顯示名稱</label><input className="input" id="register-name" name="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength={80} placeholder="例如：Jocke" /></div>
    <div className="field"><label htmlFor="register-email">Email</label><input className="input" id="register-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={254} /></div>
    <div className="field"><label htmlFor="register-password">密碼</label><input className="input" id="register-password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} /><small className={styles.hint}>至少 8 碼，請勿與其他網站共用。</small></div>
    {errorMessage && <div className={styles.error} role="alert">{errorMessage}</div>}
    {successMessage && <div className={styles.success} role="status">{successMessage}</div>}
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? "建立中…" : "建立會員帳號"}</button>
  </form>;
}
