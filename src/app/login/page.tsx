import { ensureDefaultAdmin } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureDefaultAdmin();
  return <LoginForm />;
}
