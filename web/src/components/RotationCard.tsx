import Link from "next/link";
import { Kicker } from "@/components/Section";
import { BENCHMARK_LABELS, loadRotation, moves, userBenchmark } from "@/lib/rotation";

const weekOf = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** Today's rotation summary: the regime, how many sectors moved, a link to the page. Your money split leads the page itself. */
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
        {" The regime says which group of sectors is ahead now, not what comes next."}
      </p>
    </>,
  );
}
