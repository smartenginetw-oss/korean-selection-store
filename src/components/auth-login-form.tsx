"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { getCanonicalAuthOrigin } from "@/lib/site";
import { isBackofficeRole } from "@/lib/supabase/roles";
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

  async function handleLineLogin() {
    setPending(true);
    setErrorMessage("");

    const redirectTo = `${getCanonicalAuthOrigin(audience)}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      // LINE is configured as a Supabase Custom OAuth provider.
      provider: "custom:line",
      options: { redirectTo },
    });

    if (error) {
      setErrorMessage(isAdmin
        ? "LINE 管理端登入尚未完成設定，請先使用 Email 與密碼登入。"
        : "LINE 登入目前尚未完成設定，請先使用 Email 與密碼登入。");
      setPending(false);
    }
  }

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

    if (isAdmin && !isBackofficeRole(role?.role)) {
      await supabase.auth.signOut();
      setErrorMessage("這個帳號沒有後台權限，請聯絡老闆授權。");
      setPending(false);
      return;
    }

    if (!isAdmin && isBackofficeRole(role?.role)) {
      await supabase.auth.signOut();
      setErrorMessage("這是老闆帳號，請改由後台登入入口進入。");
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
      <input className="input" id={`${audience}-login-password`} name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required minLength={8} />
    </div>
    {errorMessage && <div className={styles.error} role="alert">{errorMessage}</div>}
    <button className="button button-primary" type="submit" disabled={pending}>{pending ? "登入中…" : isAdmin ? "登入管理後台" : "登入會員帳號"}</button>
    <div className={styles.divider} aria-hidden="true"><span>或使用其他方式</span></div>
    <button className={`button button-secondary ${styles.socialButton}`} type="button" onClick={handleLineLogin} disabled={pending}>
      {pending ? "連線中…" : "使用 LINE 登入"}
    </button>
    <p className={styles.socialHint}>{isAdmin ? "僅限已授權後台角色的 LINE 帳號。" : "首次使用 LINE 會自動建立會員帳號。"}</p>
    <Link className={styles.forgotLink} href={`/forgot-password?audience=${isAdmin ? "admin" : "member"}&next=${encodeURIComponent(nextPath)}`}>忘記密碼？</Link>
  </form>;
}
