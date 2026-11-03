import {
  JetBrains_Mono,
  Lato,
  Lora,
  Playfair_Display,
} from "next/font/google";

import { cn } from "@/lib/utils";

// Sans: UI, navigation, buttons, meta. Static family, so weights are explicit.
const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
  variable: "--font-lato",
});

// Display: page titles, section headings, card titles.
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
  weight: ["400", "500", "700"],
});

// Serif: long-form article body.
const lora = Lora({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  weight: ["400", "500", "700"],
  variable: "--font-lora",
});

// Mono: code blocks and inline code.
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
  weight: ["400", "500", "700"],
});

export const FONT_CLASSNAMES = cn(
  lato.variable,
  playfairDisplay.variable,
  lora.variable,
  jetBrainsMono.variable,
);
