import { createSupabaseServer } from "./supabase-server";

/**
 * Throws if `animalId` does not belong to `farmId`.
 *
 * RLS already scopes reads/writes to the caller's farm, but an explicit check
 * gives a clear error instead of a silent foreign-key insert with a stray id,
 * and guards against orphaned references.
 */
export async function assertAnimalInFarm(farmId: string, animalId: string): Promise<void> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("animals")
    .select("id")
    .eq("farm_id", farmId)
    .eq("id", animalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Selected animal is not part of your farm.");
}
