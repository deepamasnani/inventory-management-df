import { ensureDefaultAdmin } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  await ensureDefaultAdmin();
  return <LoginForm />;
}
