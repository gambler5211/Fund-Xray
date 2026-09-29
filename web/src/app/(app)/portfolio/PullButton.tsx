"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/kit/Button";
import { REFRESH_ERRORS, refreshHoldings } from "@/lib/refresh";

/** "Pull my holdings" for a connected account that has no snapshot yet. */
export function PullButton({ label = "Pull my holdings" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await refreshHoldings();
          setBusy(false);
          if (r.ok) router.refresh();
          else setError(REFRESH_ERRORS[r.code] ?? "Couldn't pull holdings. Try again.");
        }}
        disabled={busy}
      >
        {busy ? "Pulling…" : label}
      </Button>
      {error ? (
        <p role="alert" className="font-sans text-ui text-loss">
          {error}
        </p>
      ) : null}
    </div>
  );
}
