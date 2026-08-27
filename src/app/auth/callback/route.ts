import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { adminSiteUrl } from "@/lib/site";
import { isBackofficeRole } from "@/lib/supabase/roles";
import type { Database } from "@/types/database";

function safeNextPath(value: string | null, fallback: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function isAdminPath(pathname: string) {
  return pathname === "/admin-login" || pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * Exchange Supabase's PKCE callback code before the admin middleware checks
 * authorization. Email-change links are sent from the admin app, so the
 * callback must be public long enough to establish the refreshed session.
 */
export async function GET(request: NextRequest) {
  const callbackUrl = request.nextUrl;
  const defaultNextPath = process.env.NEXT_PUBLIC_APP_MODE === "admin" ? "/admin" : "/";
  const nextPath = safeNextPath(callbackUrl.searchParams.get("next"), defaultNextPath);
  const redirectUrl = new URL(nextPath, request.url);
  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const code = callbackUrl.searchParams.get("code");
  const providerError = callbackUrl.searchParams.get("error");
  if (providerError) {
    return redirectToLogin(request, nextPath);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirectToLogin(request, nextPath);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirectToLogin(request, nextPath);

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const isBackoffice = isBackofficeRole(role?.role);

    if (isAdminPath(nextPath) && !isBackoffice) {
      await supabase.auth.signOut();
      const loginUrl = new URL("/admin-login", request.url);
      loginUrl.searchParams.set("next", nextPath);
      loginUrl.searchParams.set("notice", "admin_role_required");
      response.headers.set("Location", loginUrl.toString());
      return response;
    }

    if (!isAdminPath(nextPath) && isBackoffice) {
      await supabase.auth.signOut();
      const adminOrigin = process.env.NEXT_PUBLIC_APP_MODE === "store" ? adminSiteUrl : request.nextUrl.origin;
      const loginUrl = new URL("/admin-login", adminOrigin);
      loginUrl.searchParams.set("next", "/admin");
      loginUrl.searchParams.set("notice", "admin_account_use_admin_portal");
      response.headers.set("Location", loginUrl.toString());
      return response;
    }
  }

  return response;
}

function redirectToLogin(request: NextRequest, nextPath: string) {
  const loginUrl = new URL(isAdminPath(nextPath) ? "/admin-login" : "/login", request.url);
  loginUrl.searchParams.set("next", nextPath);
  loginUrl.searchParams.set("notice", "auth_callback_failed");
  return NextResponse.redirect(loginUrl);
}
