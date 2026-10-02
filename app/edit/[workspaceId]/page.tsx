import { EditorShell } from "@/components/editor/EditorShell";

export default async function EditPage({ params }: PageProps<"/edit/[workspaceId]">) {
  const { workspaceId } = await params;
  return <EditorShell workspaceId={workspaceId} />;
}
