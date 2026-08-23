import { AuthLoginForm } from "@/components/auth-login-form";

export function LoginForm({ nextPath }: { nextPath: string }) {
  return <AuthLoginForm audience="member" nextPath={nextPath} />;
}
