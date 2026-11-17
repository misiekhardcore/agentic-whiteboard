import { BoardCard } from "./BoardCard";
import { BoardColumn } from "./BoardColumn";
import { LiveCursor } from "./LiveCursor";
import { MockFrame } from "./MockFrame";

export function BoardMock() {
  return (
    <MockFrame file="team.board">
      <div className="relative aspect-4/3 overflow-hidden bg-muted/30 p-3">
        <div className="grid grid-cols-3 gap-2.5">
          <BoardColumn label="Backlog" count={3} marker="bg-border">
            <BoardCard title="Pricing page" tag="docs" />
            <BoardCard title="Onboarding flow" tag="canvas" />
            <BoardCard title="Mobile nav" tag="canvas" />
          </BoardColumn>

          <BoardColumn
            label="In progress"
            count={2}
            marker="bg-chart-3"
            className="border-primary/40 bg-primary/5"
          >
            <BoardCard title="Checkout diagram" tag="canvas" highlighted />
            <BoardCard title="Auth spec" tag="docs" />
          </BoardColumn>

          <BoardColumn label="Shipped" count={2} marker="bg-success">
            <BoardCard title="Q4 roadmap" tag="board" />
            <BoardCard title="API architecture" tag="canvas" />
          </BoardColumn>
        </div>

        <LiveCursor name="Maya" tone="amber" className="top-[43%] left-[38%]" />
        <LiveCursor name="Ari" tone="violet" className="top-[64%] left-[8%]" />
      </div>
    </MockFrame>
  );
}
