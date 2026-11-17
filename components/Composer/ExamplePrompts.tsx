import { Button } from "@konopskidev/ui/components/button";

import { EXAMPLE_PROMPTS } from "@/lib/ai/thread/composer";

export function ExamplePrompts({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <ul aria-label="Example prompts" className="flex flex-wrap gap-2">
      {EXAMPLE_PROMPTS.map((prompt) => (
        <li key={prompt}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto rounded-full py-1.5 text-left"
            onClick={() => onPick(prompt)}
          >
            {prompt}
          </Button>
        </li>
      ))}
    </ul>
  );
}
