"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/kit/States";
import { Button } from "@/components/kit/Button";

/** Any signed-in page that throws: say so plainly, keep the masthead, offer a retry. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="py-7">
      <ErrorState
        title="This page didn't load"
        body="Something failed while fetching your data. Nothing was changed in your account or at Zerodha. Try again; if it keeps happening, the footer shows whether the API is reachable."
        action={
          <Button variant="secondary" onClick={reset}>
            Try again
          </Button>
        }
      />
      {error.digest ? <p className="mt-3 font-sans text-caption text-ink-3">Reference: {error.digest}</p> : null}
    </div>
  );
}
