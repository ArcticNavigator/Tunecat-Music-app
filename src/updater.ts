// ─────────────────────────────────────────────────────────────────────────────
// updater.ts — in-app auto-update
// ─────────────────────────────────────────────────────────────────────────────
//
// On startup we ask Tauri's updater plugin to check the signed release manifest
// (configured in tauri.conf.json → plugins.updater.endpoints). If a newer, properly
// SIGNED version exists, we download + install it and relaunch into it.
//
// This is intentionally fail-safe: it no-ops outside Tauri (the Vite dev browser has
// no updater runtime) and swallows every error — offline, an unreachable or not-yet-
// configured endpoint, a signature mismatch — so a failed check can NEVER block or
// crash startup. The worst case is simply "no update applied this launch."
// ─────────────────────────────────────────────────────────────────────────────

export type UpdateStatus =
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "downloading"; version: string }
  | { state: "installing"; version: string }
  | { state: "none" }
  | { state: "error"; message: string };

/**
 * Check for an update and, if one is available, install it and relaunch.
 * `onStatus` (optional) receives progress so the UI can show a small notice.
 */
export async function checkForUpdates(
  onStatus: (s: UpdateStatus) => void = () => {},
): Promise<void> {
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    onStatus({ state: "checking" });

    const update = await check();
    if (!update) {
      onStatus({ state: "none" });
      return;
    }

    onStatus({ state: "available", version: update.version });
    console.log(
      `Update ${update.version} available (current ${update.currentVersion}); installing…`,
    );

    onStatus({ state: "downloading", version: update.version });
    await update.downloadAndInstall();

    onStatus({ state: "installing", version: update.version });
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (e) {
    // Not in Tauri, offline, endpoint not configured yet, signature mismatch, etc.
    console.debug("Update check skipped:", e);
    onStatus({ state: "error", message: String(e) });
  }
}
