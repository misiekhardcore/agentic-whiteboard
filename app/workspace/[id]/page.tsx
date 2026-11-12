import { Loading } from "@/components/Loading/Loading";

// The id comes from the URL, so this route renders per request.
export const instant = false;

export default async function WorkspacePage({
  params,
}: PageProps<"/workspace/[id]">) {
  const { id } = await params;

  return (
    <main className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6">
      <Loading label={`Opening workspace ${id}…`} />
    </main>
  );
}
