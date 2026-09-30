"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/kit/Card";
import { Button } from "@/components/kit/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabaseBrowser } from "@/lib/supabase/client";
import { istTime } from "@/lib/format";
import type { KiteStatus as Kite } from "@/lib/kite";
import { INPUT } from "./SettingsForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Account: who you are, Kite connection, theme, a live check that the API accepts your sign-in, delete. */
export function AccountCard({ name, email, kite, demo = false }: { name: string | null; email: string; kite: Kite; demo?: boolean }) {
  return (
    <Card title="Account">
      <dl className="flex flex-col">
        <Row term="Signed in as">
          <span className="flex flex-col items-end text-right">
            {name ? <span className="text-ink">{name}</span> : null}
            <span className="font-sans text-ui text-ink-3">{email}</span>
          </span>
        </Row>
        <Row term="Zerodha (Kite)">
          <KiteStatus kite={kite} demo={demo} />
        </Row>
        <Row term="Theme">
          <ThemeToggle />
        </Row>
        <Row term="API check">
          <ApiCheck demo={demo} />
        </Row>
      </dl>

      <div className="flex flex-col gap-4 pt-5">
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="secondary" disabled={demo}>
            Sign out
          </Button>
        </form>
        <DeleteAccount demo={demo} />
      </div>
    </Card>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-rule py-3 first:pt-0">
      <dt className="font-sans text-ui font-semibold text-ink">{term}</dt>
      <dd className="text-body">{children}</dd>
    </div>
  );
}

function KiteStatus({ kite, demo }: { kite: Kite; demo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    if (demo) return;
    setBusy(true);
    setError(null);
    const { data } = await supabaseBrowser().auth.getSession();
    try {
      const r = await fetch(`${API_URL}/kite/session`, { method: "DELETE", headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      if (!r.ok) throw new Error(String(r.status));
      router.refresh();
    } catch {
      setError("Couldn't disconnect. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const link = "font-sans text-ui";
  if (kite.state === "never") {
    return (
      <span className="flex items-center gap-3 font-sans text-ui text-ink-3">
        Not connected <a href="/kite/connect" className={link}>Connect</a>
      </span>
    );
  }
  const until = kite.expiresAt
    ? istTime(kite.expiresAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "";
  return (
    <span className="flex flex-col items-end gap-1 text-right">
      <span className={`font-sans text-ui ${kite.state === "connected" ? "text-gain" : "text-ink-3"}`}>
        {kite.state === "connected" ? `${kite.kiteUserId ?? "Connected"} · until ${until}` : "Expired at 6 AM"}
      </span>
      <span className="flex gap-3">
        {kite.state === "expired" ? <a href="/kite/connect" className={link}>Reconnect</a> : null}
        <button type="button" onClick={disconnect} disabled={busy || demo} className="font-sans text-ui text-loss underline decoration-loss underline-offset-4 disabled:opacity-50">
          {busy ? "Disconnecting…" : "Disconnect"}
        </button>
      </span>
      {error ? <span role="alert" className="font-sans text-caption text-loss">{error}</span> : null}
    </span>
  );
}

function ApiCheck({ demo }: { demo: boolean }) {
  const [state, setState] = useState<"checking" | "ok" | "rejected" | "offline">("checking");

  useEffect(() => {
    if (demo) {
      setState("ok");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabaseBrowser().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return !cancelled && setState("rejected");
      try {
        const r = await fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!cancelled) setState(r.ok ? "ok" : "rejected");
      } catch {
        if (!cancelled) setState("offline");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo]);

  const text = {
    checking: ["Checking…", "text-ink-3"],
    ok: ["The API recognises you", "text-gain"],
    rejected: ["The API didn't accept your sign-in", "text-loss"],
    offline: ["API offline", "text-loss"],
  }[state];
  return (
    <span role="status" className={`font-sans text-ui ${text[1]}`}>
      {text[0]}
    </span>
  );
}

function DeleteAccount({ demo }: { demo: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const armed = typed.trim().toLowerCase() === "delete";

  async function remove() {
    if (demo || !armed) return;
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setBusy(false);
      setError("Couldn't delete right now. Nothing was removed; try again.");
      return;
    }
    await supabase.auth.signOut();
    window.location.assign("/welcome?deleted=1");
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start font-sans text-ui text-loss underline decoration-loss underline-offset-4">
        Delete my account and all data…
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 border border-loss p-4">
      <p className="text-body leading-relaxed text-ink-2">
        This removes your sign-in, settings, Kite connection and every holdings snapshot, for good. Type <strong>delete</strong> to confirm.
      </p>
      <input
        aria-label="Type delete to confirm"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        className={`${INPUT} w-full text-left font-sans`}
      />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={remove}
          disabled={!armed || busy || demo}
          className="inline-flex h-11 items-center bg-loss px-5 font-sans text-ui font-semibold text-on-fill disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Delete everything"}
        </button>
        <Button type="button" variant="secondary" onClick={() => (setOpen(false), setTyped(""))}>
          Keep my account
        </Button>
      </div>
      {error ? (
        <p role="alert" className="font-sans text-caption font-semibold text-loss">
          {error}
        </p>
      ) : null}
    </div>
  );
}
