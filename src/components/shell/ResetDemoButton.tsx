"use client";

import { useTransition } from "react";
import { resetDemoAction } from "@/server/actions";
import { Button } from "@/components/ui/Button";

export function ResetDemoButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => start(() => resetDemoAction())}
      title="Restore the seeded demo day"
    >
      {pending ? "Resetting…" : "Reset demo"}
    </Button>
  );
}
