import { toast } from "sonner";

/** Copies a message's prose, which is what the person can see and select. */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to the clipboard");
  } catch {
    toast.error("Could not copy to the clipboard.");
  }
}
