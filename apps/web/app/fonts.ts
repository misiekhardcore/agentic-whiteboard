import { JetBrains_Mono, Lato, Lora, Playfair_Display } from "next/font/google";

// The same four faces `main` uses: Lato for UI chrome, Playfair Display for
// headings, Lora for the document body and JetBrains Mono for code.
const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
  variable: "--font-lato",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
  weight: ["400", "500", "700"],
});

const lora = Lora({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  weight: ["400", "500", "700"],
  variable: "--font-lora",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
  weight: ["400", "500", "700"],
});

export const FONT_CLASSNAMES = [
  lato.variable,
  playfairDisplay.variable,
  lora.variable,
  jetBrainsMono.variable,
].join(" ");
