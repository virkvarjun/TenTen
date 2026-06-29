import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeartbeatPanel } from "@/components/heartbeat/HeartbeatPanel";

vi.mock("@/server/actions", () => ({
  checkInAction: vi.fn().mockResolvedValue(undefined),
}));

const current = {
  label: "Ship v1",
  type: "deep" as const,
  startHour: 10,
  endHour: 11,
  blockId: "b1",
};

describe("HeartbeatPanel", () => {
  it("stays silent (no nudge) when you're on plan", () => {
    render(<HeartbeatPanel current={current} drifting={false} recent={[]} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /still on it/i })).toBeInTheDocument();
  });

  it("raises a gentle nudge only when drifting from a deep block", () => {
    render(<HeartbeatPanel current={current} drifting={true} recent={[]} />);
    const nudge = screen.getByRole("status");
    expect(nudge).toHaveTextContent(/just a nudge/i);
  });

  it("shows a calm empty state when nothing is scheduled", () => {
    render(<HeartbeatPanel current={null} drifting={false} recent={[]} />);
    expect(screen.getByText(/Meridian stays quiet/i)).toBeInTheDocument();
  });

  it("lists today's check-ins", () => {
    render(
      <HeartbeatPanel
        current={current}
        drifting={false}
        recent={[{ id: "c1", hour: 9.5, actualType: "deep", note: "scheduler module" }]}
      />,
    );
    expect(screen.getByText(/scheduler module/i)).toBeInTheDocument();
  });
});
