import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventsBoard } from "@/components/events/EventsBoard";
import type { SubmitAskResult } from "@/server/actions";

const { submitResult } = vi.hoisted(() => ({
  submitResult: {
    recordId: "ask-1",
    engine: "heuristic" as const,
    parsed: { description: "run at 4", durationMin: 45 },
    decision: {
      verdict: "accept" as const,
      suggestedSlot: { start: new Date(2026, 5, 28, 16, 0), end: new Date(2026, 5, 28, 16, 45) },
      displaces: [],
      rationale: "4pm sits in your post-peak dip, so a health block costs you no focus time.",
    },
  } satisfies SubmitAskResult,
}));

vi.mock("@/server/actions", () => ({
  submitAskAction: vi.fn().mockResolvedValue(submitResult),
  acceptAskAction: vi.fn().mockResolvedValue(undefined),
  declineAskAction: vi.fn().mockResolvedValue(undefined),
  undoAskAction: vi.fn().mockResolvedValue(undefined),
}));

describe("EventsBoard", () => {
  it("shows an empty earlier-decisions state with real copy", () => {
    render(<EventsBoard history={[]} />);
    expect(screen.getByText(/No asks yet/i)).toBeInTheDocument();
  });

  it("composes an ask and renders the verdict card with rationale", async () => {
    const user = userEvent.setup();
    render(<EventsBoard history={[]} />);
    await user.type(screen.getByLabelText(/asking for your time/i), "run at 4, 45 min");
    await user.click(screen.getByRole("button", { name: /ask meridian/i }));

    await waitFor(() => expect(screen.getByText("Accept")).toBeInTheDocument());
    expect(screen.getByText(/post-peak dip/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to my day/i })).toBeInTheDocument();
  });

  it("fills the composer from an example chip", async () => {
    const user = userEvent.setup();
    render(<EventsBoard history={[]} />);
    await user.click(screen.getByRole("button", { name: /Raj wants to run at 4/i }));
    expect(screen.getByLabelText(/asking for your time/i)).toHaveValue(
      "Raj wants to run at 4, ~45 min",
    );
  });
});
