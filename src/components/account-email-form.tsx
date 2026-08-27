"use client";

import { FormEvent, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import styles from "./account-password-form.module.css";

export function AccountEmailForm({ currentEmail, suggestedEmail }: { currentEmail: string; suggestedEmail: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState(suggestedEmail);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail || nextEmail === currentEmail.toLowerCase()) {
      setError("請輸入與目前不同的信箱。");
      return;
    }

    setPending(true);
    // The admin and storefront are separate Vercel apps. Explicitly route both
    // confirmation links back to the admin app so the owner does not land on
    // the storefront with an unrelated session or lose the verification flow.
    const emailRedirectTo = typeof window === "undefined"
      ? undefined
      : (() => {
          const callbackUrl = new URL("/auth/callback", window.location.origin);
          callbackUrl.searchParams.set("next", "/admin/settings");
          return callbackUrl.toString();
        })();
    const { error: updateError } = await supabase.auth.updateUser(
      { email: nextEmail },
      { emailRedirectTo },
    );
    if (updateError) {
      const updateMessage = updateError.message.toLowerCase();
      if (/rate limit|too many|over_email_send_rate_limit|429/.test(updateMessage)) {
        setError("確認信剛剛已寄出，為避免重複寄送，請稍候幾分鐘再試；也請先檢查目前與新信箱的收件匣及垃圾郵件。");
      } else if (/already|registered|duplicate|unique|taken/.test(updateMessage)) {
        setError("這個信箱已經被其他帳號使用。");
      } else if (/invalid email|email address/.test(updateMessage)) {
        setError("請確認新登入信箱格式正確。");
      } else {
        setError("信箱更新失敗，請稍後再試。");
      }
    } else {
      setMessage("變更申請已送出。請只使用兩個信箱最新收到的確認信，完成目前信箱與新信箱的雙重驗證；確認後會回到管理站設定頁。若其中一封已失效，請不要連續重送，等限流解除後再申請一次。");
    }
    setPending(false);
  }

  return <form className={styles.form} onSubmit={handleSubmit}>
    <div className={styles.fields}>
      <div className="field"><label htmlFor="owner-new-email">新的登入信箱</label><input className="input" id="owner-new-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={254} /></div>
    </div>
    <p className={styles.hint}>目前登入信箱：{currentEmail}。完成雙信箱驗證後，老闆的 admin 權限與原有資料會保留。</p>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {message && <div className={styles.message} role="status">{message}</div>}
    <button className="button button-secondary button-small" type="submit" disabled={pending}>{pending ? "送出中…" : "申請變更登入信箱"}</button>
  </form>;
}
