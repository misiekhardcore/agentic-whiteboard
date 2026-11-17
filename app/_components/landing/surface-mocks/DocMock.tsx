import { FileText, Wand2 } from "lucide-react";

import { MockFrame } from "./MockFrame";

export function DocMock() {
  return (
    <MockFrame file="checkout-spec.doc">
      <div className="relative aspect-4/3 overflow-hidden bg-card px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Docs / Checkout flow
          </p>
          <span className="rounded-sm border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-primary uppercase">
            Agent draft
          </span>
        </div>

        <h3 className="mt-2.5 font-display text-xl font-semibold">Checkout flow — spec</h3>

        <div className="mt-3 space-y-3 text-[11.5px] leading-relaxed text-muted-foreground">
          <p>
            Customers move from cart to confirmation in three steps.{" "}
            <span className="bg-primary/10 text-foreground">Each step is reversible</span> so a
            failed payment never loses the cart.
          </p>

          <div className="rounded-sm border-l-2 border-primary/50 bg-primary/5 px-2.5 py-2">
            <p className="font-sans text-[9px] font-bold tracking-[0.12em] text-primary uppercase">
              Summarized by the agent
            </p>
            <p className="mt-1 text-xs leading-snug text-foreground/80">
              Three-step flow, generated from{" "}
              <span className="font-mono text-[10px]">flow.canvas</span> · 2 min ago
            </p>
          </div>

          <div>
            <p className="font-sans text-[10px] font-bold tracking-[0.12em] text-foreground uppercase">
              Review step
            </p>
            <ul className="mt-1.5 space-y-1">
              <li className="flex items-start gap-1.5">
                <span className="mt-1.25 size-1 shrink-0 rounded-full bg-primary/60" />
                Address and delivery options
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-1.25 size-1 shrink-0 rounded-full bg-primary/60" />
                Discount code applied inline
              </li>
            </ul>
          </div>
        </div>

        {/* agent actions on the current section */}
        <div className="absolute right-4 bottom-4 flex items-center gap-1 rounded-sm border bg-card p-1 shadow-sm">
          <span className="flex items-center gap-1 rounded-xs bg-primary px-1.5 py-1 text-[9px] font-bold text-primary-foreground">
            <Wand2 className="size-2.5" />
            Rewrite
          </span>
          <span className="flex items-center gap-1 px-1.5 py-1 text-[9px] font-medium text-muted-foreground">
            <FileText className="size-2.5" />
            Summarize
          </span>
        </div>
      </div>
    </MockFrame>
  );
}
