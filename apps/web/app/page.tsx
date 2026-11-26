import { DEMO_WORKSPACE } from "@v2/db/demo";
import { redirect } from "next/navigation";

export default function HomePage(): never {
  redirect(`/w/${DEMO_WORKSPACE.id}`);
}
