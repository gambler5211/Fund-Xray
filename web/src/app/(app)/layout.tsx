import { Masthead } from "@/components/Masthead";
import { BottomNav } from "@/components/BottomNav";
import { Footer } from "@/components/Footer";
import { currentUser } from "@/lib/supabase/server";
import { kiteStatus } from "@/lib/kite";

/** Signed-in pages: masthead with app navigation, footer, phone tab bar. */
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The middleware has already sent signed-out visitors to /login (except the /ui review page).
  const user = await currentUser();
  const kite = user ? await kiteStatus(user.id) : null;
  return (
    <>
      <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col px-5 pb-24 md:px-18 md:pb-8">
        <Masthead user={user} kite={kite} />
        <main className="fade-in flex-1">{children}</main>
        <Footer />
      </div>
      <BottomNav />
    </>
  );
}
