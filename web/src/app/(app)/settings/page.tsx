import { Kicker } from "@/components/Section";
import { ErrorState } from "@/components/kit/States";
import { DEFAULT_SETTINGS, SETTINGS_COLUMNS, fromRow } from "@/lib/settings";
import { currentUser, supabaseServer } from "@/lib/supabase/server";
import { kiteStatus } from "@/lib/kite";
import { AccountCard } from "./AccountCard";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "Settings · Fund X-Ray" };

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) {
    return <ErrorState title="You're signed out" body="Sign in again to see your settings." />;
  }

  const supabase = await supabaseServer();
  const [settings, kite] = await Promise.all([
    supabase.from("settings").select(SETTINGS_COLUMNS).eq("user_id", user.id).maybeSingle(),
    kiteStatus(user.id),
  ]);

  return (
    <div className="flex flex-col gap-7 py-7 md:py-8">
      <section className="flex flex-col gap-3 border-b border-ink pb-6">
        <Kicker>Settings</Kicker>
        <h1 className="text-[30px] font-medium leading-[1.1] tracking-[-0.015em] md:text-h2">Your benchmark, targets and alerts</h1>
        <p className="max-w-[62ch] text-body leading-relaxed text-ink-2">
          These shape every page: what you&apos;re compared against, the band you aim for, and when to warn you.
        </p>
      </section>

      {settings.error ? (
        <ErrorState title="Couldn't load your settings" body="The database didn't answer. Reload the page to try again." />
      ) : (
        <SettingsForm userId={user.id} initial={settings.data ? fromRow(settings.data as Record<string, unknown>) : DEFAULT_SETTINGS} />
      )}

      <div className="md:max-w-[calc(50%-16px)]">
        <AccountCard name={user.name} email={user.email} kite={kite} />
      </div>
    </div>
  );
}
