import { Masthead } from "@/components/Masthead";
import { BottomNav } from "@/components/BottomNav";
import { Footer } from "@/components/Footer";

/** Signed-in pages: masthead with app navigation, footer, phone tab bar. */
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col px-5 pb-24 md:px-18 md:pb-8">
        <Masthead />
        <main className="fade-in flex-1">{children}</main>
        <Footer />
      </div>
      <BottomNav />
    </>
  );
}
