"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import styles from "./login.module.css";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMessage("Email 或密碼不正確，請重新確認。若尚未開通管理員帳號，請先在 Supabase Auth 建立帳號並授予 admin 角色。");
      setPending(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return <form onSubmit={handleSubmit}>
    <div className="field">
      <label htmlFor="login-email">Email</label>
      <input className="input" id="login-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
    </div>
    <div className="field">
      <label htmlFor="login-password">密碼</label>
      <input className="input" id="login-password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required minLength={6} />
    </div>
    {errorMessage && <div className={styles.error} role="alert">{errorMessage}</div>}
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? "登入中…" : "登入管理後台"}</button>
  </form>;
}
