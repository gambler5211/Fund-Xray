import Link from "next/link";
import { Kicker } from "@/components/Section";
import { BENCHMARK_LABELS, CLOCKWISE, loadRotation, moneyByQuadrant, moves, userBenchmark } from "@/lib/rotation";
import { QUADRANTS } from "@/lib/quadrant";

const weekOf = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const pctText = (n: number) => `${n >= 9.95 ? Math.round(n) : n.toFixed(1)}%`;

/** Today's rotation summary: the regime, how many sectors moved, where your money sits, a link to the page. */
export async function RotationCard({ userId }: { userId: string }) {
  const benchmark = await userBenchmark(userId);
  const data = await loadRotation(benchmark);
  const shell = (body: React.ReactNode) => (
    <div className="flex flex-col items-start gap-3 border border-ink p-5 md:p-6">
      {body}
      <Link href="/rotation" className="font-sans text-ui font-semibold">
        See rotation →
      </Link>
    </div>
  );
  if (data.state !== "ok") {
    return shell(
      <>
        <h2 className="text-lead font-semibold">Rotation</h2>
        <p className="text-body leading-relaxed text-ink-2">
          {data.state === "empty" ? "Sector scores appear here after the nightly market-data run." : "Rotation didn't load just now."}
        </p>
      </>,
    );
  }
  const { moved } = moves(data.rows);
  const money = moneyByQuadrant(data.rows);
  const parts = CLOCKWISE.filter((q) => money[q] >= 0.05).map((q) => `${pctText(money[q])} ${QUADRANTS[q].label}`);
  const r = data.regime;
  return shell(
    <>
      <Kicker>Rotation · week to {weekOf(data.asOf)}</Kicker>
      <h2 className="text-[26px] font-semibold leading-tight">
        {r ? `${r.regime}${r.weeks > 1 ? `, ${r.weeks >= 12 ? "12+" : r.weeks} weeks running` : ", new this week"}` : "Sector rotation"}
      </h2>
      <p className="text-body leading-relaxed text-ink-2">
        {moved.length === 0 ? "No sector changed quadrant this week" : `${moved.length} ${moved.length === 1 ? "sector" : "sectors"} changed quadrant this week`}
        {` against the ${BENCHMARK_LABELS[benchmark]}.`}
        {data.hasHoldings && parts.length ? ` Your money: ${parts.join(", ")}.` : ""}
      </p>
    </>,
  );
}
