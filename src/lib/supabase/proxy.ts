import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";
import { isBackofficeRole } from "@/lib/supabase/roles";

/**
 * Refresh the Supabase SSR session and apply an optimistic admin redirect.
 * Full authorization is repeated in the admin layout and server actions.
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const appMode = process.env.NEXT_PUBLIC_APP_MODE ?? process.env.APP_MODE;

  // Store and admin are deployed as separate Vercel projects. Keep a local
  // unset APP_MODE permissive so the same checkout can still be developed
  // locally without maintaining two copies of the repository.
  if (appMode === "admin" && pathname === "/login") {
    return redirectToAdminLogin(request);
  }
  if (appMode === "admin" && pathname !== "/admin-login" && !pathname.startsWith("/admin")) {
    return redirectToPath(request, "/admin");
  }
  if (appMode === "store" && (pathname === "/admin-login" || pathname.startsWith("/admin"))) {
    return redirectToPath(request, "/");
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (pathname.startsWith("/admin") && pathname !== "/admin-login") {
    if (!user) {
      return redirectToLogin(request);
    }

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!isBackofficeRole(role?.role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "?notice=admin_only";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

function redirectToLogin(request: NextRequest) {
  return redirectToPath(request, "/admin-login", `?next=${encodeURIComponent(request.nextUrl.pathname)}`);
}

function redirectToAdminLogin(request: NextRequest) {
  return redirectToPath(request, "/admin-login");
}

function redirectToPath(request: NextRequest, pathname: string, search = "") {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  return NextResponse.redirect(url);
}
