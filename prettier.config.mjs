/** @type {import("prettier").Config} */
const config = {
  printWidth: 100,
  tabWidth: 2,
  trailingComma: "all",
  endOfLine: "lf",
  semi: true,
  // The Tailwind plugin must load last so it sees the final class strings.
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./app/globals.css",
};

export default config;
