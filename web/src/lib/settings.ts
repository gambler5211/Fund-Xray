import { z } from "zod";

export const BENCHMARKS = ["NIFTY 50", "NIFTY 500", "NIFTY MIDCAP 150", "NIFTY SMALLCAP 250"] as const;

const pct = (min: number, max: number) =>
  z
    .number({ error: "Enter a number" })
    .min(min, `At least ${min}%`)
    .max(max, `At most ${max}%`);

/** The editable settings. Mirrors the checks in the database migration. */
export const settingsSchema = z
  .object({
    benchmark: z.enum(BENCHMARKS),
    index_target_low: pct(0, 100),
    index_target_high: pct(0, 100),
    monthly_amount: z
      .number({ error: "Enter an amount in rupees" })
      .min(0, "Can't be negative")
      .max(1_00_00_00_000, "That looks too large")
      .nullable(),
    alert_stock_weight_pct: pct(1, 100),
    alert_sector_weight_pct: pct(1, 100),
    alert_weakening_share_pct: pct(1, 100),
    alert_day_move_pct: pct(0.5, 50),
  })
  .refine((s) => s.index_target_low <= s.index_target_high, {
    path: ["index_target_high"],
    message: "The upper end must be at least the lower end",
  });

export type SettingsValues = z.infer<typeof settingsSchema>;

export const SETTINGS_COLUMNS = "benchmark,index_target_low,index_target_high,monthly_amount,alert_stock_weight_pct,alert_sector_weight_pct,alert_weakening_share_pct,alert_day_move_pct";

/** Defaults used by the database for new users; shown on /ui as sample values. */
export const DEFAULT_SETTINGS: SettingsValues = {
  benchmark: "NIFTY 500",
  index_target_low: 20,
  index_target_high: 40,
  monthly_amount: null,
  alert_stock_weight_pct: 10,
  alert_sector_weight_pct: 30,
  alert_weakening_share_pct: 40,
  alert_day_move_pct: 5,
};

/** Postgres numeric columns arrive as strings or numbers; normalise to numbers. */
export function fromRow(row: Record<string, unknown>): SettingsValues {
  const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  return {
    benchmark: (BENCHMARKS as readonly string[]).includes(String(row.benchmark)) ? (row.benchmark as SettingsValues["benchmark"]) : "NIFTY 500",
    index_target_low: n(row.index_target_low) ?? DEFAULT_SETTINGS.index_target_low,
    index_target_high: n(row.index_target_high) ?? DEFAULT_SETTINGS.index_target_high,
    monthly_amount: n(row.monthly_amount),
    alert_stock_weight_pct: n(row.alert_stock_weight_pct) ?? DEFAULT_SETTINGS.alert_stock_weight_pct,
    alert_sector_weight_pct: n(row.alert_sector_weight_pct) ?? DEFAULT_SETTINGS.alert_sector_weight_pct,
    alert_weakening_share_pct: n(row.alert_weakening_share_pct) ?? DEFAULT_SETTINGS.alert_weakening_share_pct,
    alert_day_move_pct: n(row.alert_day_move_pct) ?? DEFAULT_SETTINGS.alert_day_move_pct,
  };
}
