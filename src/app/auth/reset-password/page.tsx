import { ResetPasswordForm } from "@/components/reset-password-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return <ResetPasswordForm />;
}
