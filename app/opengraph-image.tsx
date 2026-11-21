import { OG_ALT, OG_SIZE, renderBrandOgImage } from "./_components/og/BrandOgImage";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderBrandOgImage();
}
