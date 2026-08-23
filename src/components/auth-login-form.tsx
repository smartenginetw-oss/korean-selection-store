"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import styles from "./auth-login-form.module.css";

type Audience = "member" | "admin";

export function AuthLoginForm({ audience, nextPath }: { audience: Audience; nextPath: string }) {
  const router = useRouter();
  const supabase = createClient();
  const isAdmin = audience === "admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      setErrorMessage(isAdmin ? "Email 或密碼不正確，請重新確認。" : "Email 或密碼不正確，請重新確認；尚未註冊也可以直接訪客結帳。");
      setPending(false);
      return;
    }

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (isAdmin && role?.role !== "admin") {
      await supabase.auth.signOut();
      setErrorMessage("這個帳號沒有後台權限，請使用管理員帳號登入。");
      setPending(false);
      return;
    }

    if (!isAdmin && role?.role === "admin") {
      await supabase.auth.signOut();
      setErrorMessage("這是管理員帳號，請改由後台登入入口進入。");
      setPending(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return <form onSubmit={handleSubmit}>
    <div className="field">
      <label htmlFor={`${audience}-login-email`}>Email</label>
      <input className="input" id={`${audience}-login-email`} name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
    </div>
    <div className="field">
      <label htmlFor={`${audience}-login-password`}>密碼</label>
      <input className="input" id={`${audience}-login-password`} name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required minLength={6} />
    </div>
    {errorMessage && <div className={styles.error} role="alert">{errorMessage}</div>}
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? "登入中…" : isAdmin ? "登入管理後台" : "登入會員帳號"}</button>
  </form>;
}
