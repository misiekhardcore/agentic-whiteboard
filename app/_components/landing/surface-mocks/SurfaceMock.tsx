import type { SurfaceId } from "@/app/_data/landing";

import { BoardMock } from "./BoardMock";
import { CanvasMock } from "./CanvasMock";
import { DocMock } from "./DocMock";

export function SurfaceMock({ surface }: { surface: SurfaceId }) {
  switch (surface) {
    case "canvas":
      return <CanvasMock />;
    case "docs":
      return <DocMock />;
    case "team-board":
      return <BoardMock />;
  }
}
