import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoalsBoard } from "@/components/goals/GoalsBoard";
import type { GoalView } from "@/components/goals/types";

vi.mock("@/server/actions", () => ({
  addGoalAction: vi.fn().mockResolvedValue(undefined),
  updateGoalAction: vi.fn().mockResolvedValue(undefined),
  deleteGoalAction: vi.fn().mockResolvedValue(undefined),
}));

const goals: GoalView[] = [
  {
    id: "g1",
    title: "Ship v1",
    weight: 9,
    type: "deep",
    targetHoursPerWeek: 12,
    progressHours: 1,
    status: "active",
    pacing: "behind",
    progressFraction: 1 / 12,
  },
  {
    id: "g2",
    title: "Inbox & ops",
    weight: 4,
    type: "admin",
    targetHoursPerWeek: 5,
    progressHours: 3,
    status: "active",
    pacing: "ahead",
    progressFraction: 0.6,
  },
];

describe("GoalsBoard", () => {
  it("renders goals with their pacing state", () => {
    render(<GoalsBoard goals={goals} />);
    expect(screen.getByText("Ship v1")).toBeInTheDocument();
    expect(screen.getByText("Behind")).toBeInTheDocument();
    expect(screen.getByText("Ahead")).toBeInTheDocument();
  });

  it("shows an empty state with real copy when there are no goals", () => {
    render(<GoalsBoard goals={[]} />);
    expect(screen.getByText(/source of truth for what your day is for/i)).toBeInTheDocument();
  });

  it("opens the add-goal form on demand", async () => {
    const user = userEvent.setup();
    render(<GoalsBoard goals={goals} />);
    await user.click(screen.getByRole("button", { name: /add a goal/i }));
    expect(screen.getByLabelText(/what are you pursuing/i)).toBeInTheDocument();
  });

  it("submits a new goal through the server action", async () => {
    const { addGoalAction } = await import("@/server/actions");
    const user = userEvent.setup();
    render(<GoalsBoard goals={goals} />);
    await user.click(screen.getByRole("button", { name: /add a goal/i }));
    await user.type(screen.getByLabelText(/what are you pursuing/i), "Learn cello");
    await user.click(screen.getByRole("button", { name: /^add goal$/i }));
    expect(addGoalAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Learn cello" }));
  });
});
