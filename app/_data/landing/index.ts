/**
 * Landing page copy.
 *
 * Every sentence rendered on `/` lives in a module named for its section, so a
 * wording change touches one file and the page components stay layout.
 */
import { audience } from "./audience";
import { closing } from "./closing";
import { footer } from "./footer";
import { hero } from "./hero";
import { howItWorks } from "./howItWorks";
import { pricing } from "./pricing";
import { surfaces } from "./surfaces";

export const landing = {
  hero,
  audience,
  howItWorks,
  surfaces,
  pricing,
  closing,
  footer,
};

export type { LandingFeature, SurfaceId } from "./surfaces";
