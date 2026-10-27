import { AppShell } from "@/components/app-shell";
import { AuthForm } from "@/components/auth-form";
import { demoData } from "@/lib/demo-data";
import { getAccountData, getMySpaceData } from "@/lib/server-data";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export default async function HomePage() {
  if (!isSupabaseConfigured()) return <AppShell demo initialData={demoData} displayName="Collector" />;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <AuthForm />;
  const { data: profile } = await supabase.from("profiles").select("display_name,reduce_mascot").eq("id", user.id).maybeSingle();
  const [initialData, initialMySpaceResult] = await Promise.all([
    getAccountData(user.id),
    getMySpaceData(user.id).then((data) => ({ data, failed: false as const })).catch(() => ({ data: undefined, failed: true as const })),
  ]);
  return <AppShell initialData={initialData} initialMySpaceData={initialMySpaceResult.data} initialMySpaceError={initialMySpaceResult.failed ? "Your home summary could not be loaded. Try again." : ""} displayName={profile?.display_name || "Collector"} reduceMascot={profile?.reduce_mascot ?? false} />;
}
