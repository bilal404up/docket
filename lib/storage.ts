import type { SupabaseClient } from "@supabase/supabase-js";

/** Deletes every uploaded file in a sandbox. Files live at workspace/document/filename. */
export async function removeWorkspaceFiles(sb: SupabaseClient, workspaceId: string) {
  const bucket = sb.storage.from("uploads");
  const { data: folders } = await bucket.list(workspaceId, { limit: 100 });
  const paths: string[] = [];
  for (const folder of folders ?? []) {
    const { data: files } = await bucket.list(`${workspaceId}/${folder.name}`, { limit: 100 });
    for (const file of files ?? []) paths.push(`${workspaceId}/${folder.name}/${file.name}`);
  }
  if (paths.length) await bucket.remove(paths);
}
