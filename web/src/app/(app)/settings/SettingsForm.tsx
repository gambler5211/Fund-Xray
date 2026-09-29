"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { useForm, type FieldError, type UseFormRegisterReturn } from "react-hook-form";
import { Card } from "@/components/kit/Card";
import { Button } from "@/components/kit/Button";
import { Toast } from "@/components/kit/Toast";
import { BENCHMARKS, SETTINGS_COLUMNS, settingsSchema, type SettingsValues } from "@/lib/settings";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Portfolio and Alerts settings. Saves straight to Supabase; row-level security makes sure the
 * update can only touch your own row. `demo` skips the network (used on /ui).
 */
export function SettingsForm({ initial, userId, demo = false }: { initial: SettingsValues; userId?: string; demo?: boolean }) {
  const [toast, setToast] = useState<{ msg: string; tone: "neutral" | "error" } | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<SettingsValues>({ resolver: zodResolver(settingsSchema), defaultValues: initial, mode: "onBlur" });

  const num = { valueAsNumber: true } as const;
  const money = { setValueAs: (v: string) => (v === "" || v === null ? null : Number(String(v).replace(/,/g, ""))) };

  async function save(values: SettingsValues) {
    if (demo) {
      reset(values);
      setToast({ msg: "Saved", tone: "neutral" });
      return;
    }
    const { data, error } = await supabaseBrowser()
      .from("settings")
      .update(values)
      .eq("user_id", userId ?? "")
      .select(SETTINGS_COLUMNS)
      .single();
    if (error || !data) {
      setToast({ msg: "Couldn't save. Check your connection and try again.", tone: "error" });
      return;
    }
    reset(values);
    setToast({ msg: "Saved", tone: "neutral" });
  }

  return (
    <form onSubmit={handleSubmit(save)} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        <Card title="Portfolio">
          <div className="flex flex-col gap-5">
            <Field label="Benchmark" hint="The index your sectors and returns are compared against." error={errors.benchmark}>
              {(id, describedBy) => (
                <select id={id} aria-describedby={describedBy} {...register("benchmark")} className={`${INPUT} w-full max-w-72 pr-8 font-sans`}>
                  {BENCHMARKS.map((b) => (
                    <option key={b} value={b}>
                      {b.replace("NIFTY", "Nifty").replace("MIDCAP", "Midcap").replace("SMALLCAP", "Smallcap")}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <fieldset className="flex flex-col gap-1.5">
              <legend className={LABEL}>Index funds, target share</legend>
              <p id="band-hint" className={HINT}>
                The share of your money you want in index funds. You&apos;ll see when you drift outside it.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <Suffixed suffix="%">
                  <input aria-label="Lower end, percent" aria-describedby="band-hint" inputMode="decimal" type="number" step="any" {...register("index_target_low", num)} className={`${INPUT} text-right w-24`} aria-invalid={!!errors.index_target_low} />
                </Suffixed>
                <span className="font-sans text-ui text-ink-3">to</span>
                <Suffixed suffix="%">
                  <input aria-label="Upper end, percent" aria-describedby="band-hint" inputMode="decimal" type="number" step="any" {...register("index_target_high", num)} className={`${INPUT} text-right w-24`} aria-invalid={!!errors.index_target_high} />
                </Suffixed>
              </div>
              <ErrorText error={errors.index_target_low ?? errors.index_target_high} />
            </fieldset>

            <Field label="Monthly investment" hint="Rupees you plan to put in each month. Leave empty if it varies." error={errors.monthly_amount}>
              {(id, describedBy) => (
                <Prefixed prefix="₹">
                  <input id={id} aria-describedby={describedBy} inputMode="numeric" type="number" step="any" placeholder="Not set" {...register("monthly_amount", money)} className={`${INPUT} text-right w-40 pl-7`} aria-invalid={!!errors.monthly_amount} />
                </Prefixed>
              )}
            </Field>
          </div>
        </Card>

        <Card title="Alerts">
          <div className="flex flex-col gap-5">
            <PctField label="One stock is more than" hint="of your portfolio." reg={register("alert_stock_weight_pct", num)} error={errors.alert_stock_weight_pct} />
            <PctField label="One sector is more than" hint="of your portfolio." reg={register("alert_sector_weight_pct", num)} error={errors.alert_sector_weight_pct} />
            <PctField label="Weakening and lagging sectors hold more than" hint="of your money." reg={register("alert_weakening_share_pct", num)} error={errors.alert_weakening_share_pct} />
            <PctField label="A holding moves more than" hint="in a day, up or down." reg={register("alert_day_move_pct", num)} error={errors.alert_day_move_pct} />
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-4 border-t border-ink pt-4">
        <Button type="submit" disabled={!isDirty || isSubmitting}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
        {isDirty ? (
          <Button type="button" variant="secondary" onClick={() => reset()}>
            Undo changes
          </Button>
        ) : (
          <span className="font-sans text-caption text-ink-3">All changes saved</span>
        )}
      </div>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDone={clearToast} />
    </form>
  );
}

const LABEL = "font-sans text-ui font-semibold text-ink";
const HINT = "font-sans text-caption leading-relaxed text-ink-3";
export const INPUT =
  "figures h-11 border border-ink bg-paper px-3 text-body text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-[invalid=true]:border-loss [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: FieldError;
  children: (id: string, describedBy: string) => React.ReactNode;
}) {
  const id = `f-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className={HINT}>
          {hint}
        </p>
      ) : null}
      <div className="pt-1">{children(id, `${id}-hint`)}</div>
      <ErrorText error={error} />
    </div>
  );
}

function PctField({ label, hint, reg, error }: { label: string; hint: string; reg: UseFormRegisterReturn; error?: FieldError }) {
  const id = `f-${reg.name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <label htmlFor={id} className={LABEL}>
            {label}
          </label>
          <p id={`${id}-hint`} className={HINT}>
            {hint}
          </p>
        </div>
        <Suffixed suffix="%">
          <input id={id} aria-describedby={`${id}-hint`} inputMode="decimal" type="number" step="any" {...reg} className={`${INPUT} w-24 text-right`} aria-invalid={!!error} />
        </Suffixed>
      </div>
      <ErrorText error={error} />
    </div>
  );
}

function Suffixed({ suffix, children }: { suffix: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {children}
      <span className="font-sans text-ui text-ink-3">{suffix}</span>
    </span>
  );
}

function Prefixed({ prefix, children }: { prefix: string; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex items-center">
      <span className="pointer-events-none absolute left-3 text-body text-ink-3">{prefix}</span>
      {children}
    </span>
  );
}

function ErrorText({ error }: { error?: FieldError }) {
  if (!error?.message) return null;
  return (
    <p role="alert" className="font-sans text-caption font-semibold text-loss">
      {error.message}
    </p>
  );
}
