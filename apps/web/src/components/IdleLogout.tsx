"use client";

import { useRouter } from "next/navigation";
import { useIdleLogout } from "@/lib/useIdleLogout";

/**
 * Mounts the idle-logout clock inside an authenticated layout.
 * Renders nothing — it exists so a server layout can opt into the hook.
 */
export function IdleLogout({ loginPath }: { loginPath: string }) {
  const router = useRouter();
  useIdleLogout(true, () => {
    router.replace(`${loginPath}?error=session_expired`);
    router.refresh();
  });
  return null;
}
