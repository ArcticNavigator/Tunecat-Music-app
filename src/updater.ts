// ─────────────────────────────────────────────────────────────────────────────
// updater.ts — in-app auto-update (staged: check → download → user-chosen install)
// ─────────────────────────────────────────────────────────────────────────────
//
// On startup the app asks Tauri's updater plugin to check the signed release
// manifest (tauri.conf.json → plugins.updater.endpoints). If a newer, properly
// SIGNED version exists, the app downloads it in the background (with a notice),
// then PROMPTS the user: install now (restart) or install when the app closes.
// The download and the install are deliberately separate steps — the app never
// restarts itself without the user choosing to.
//
// Before installing we tell Rust to kill the Python sidecar: the updater ends
// this process abruptly (skipping normal window-close cleanup), and a still-
// running sidecar exe inside the install dir would lock files the installer
// must overwrite — the classic half-applied update.
//
// Everything here is fail-safe: it no-ops outside Tauri (the Vite dev browser
// has no updater runtime) and swallows every error — offline, unreachable or
// not-yet-published endpoint, signature mismatch — so a failed check can NEVER
// block or crash startup. Worst case: "no update this launch."
// ─────────────────────────────────────────────────────────────────────────────

import type { Update } from "@tauri-apps/plugin-updater";

export type { Update };

/** Result of a background check+download: an update fully downloaded and ready
 *  to install, or null (no update / not in Tauri / any failure). */
export interface ReadyUpdate {
  version: string;
  /** Release notes (markdown) from the update manifest, when the release has them. */
  notes: string | null;
  update: Update;
}

/**
 * Check for an update and, if one exists, download it fully (NOT install it).
 * `onFound` fires as soon as a newer version is detected (before the download);
 * `onProgress` receives 0–100 while downloading (null when the total size is
 * unknown). Resolves with the downloaded update, or null if there's nothing
 * to do or anything failed.
 */
export async function checkAndDownload(
  onFound: (version: string) => void = () => {},
  onProgress: (percent: number | null) => void = () => {},
): Promise<ReadyUpdate | null> {
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return null;
    onFound(update.version);

    console.log(
      `Update ${update.version} available (current ${update.currentVersion}); downloading…`,
    );

    let total = 0;
    let received = 0;
    await update.download((ev) => {
      if (ev.event === "Started") {
        total = ev.data.contentLength ?? 0;
      } else if (ev.event === "Progress") {
        received += ev.data.chunkLength;
        onProgress(total > 0 ? Math.min(100, Math.round((received / total) * 100)) : null);
      } else if (ev.event === "Finished") {
        onProgress(100);
      }
    });

    return { version: update.version, notes: update.body?.trim() || null, update };
  } catch (e) {
    // Not in Tauri, offline, endpoint not configured/published yet, bad signature…
    console.debug("Update check skipped:", e);
    return null;
  }
}

/**
 * Install a previously downloaded update and restart into the new version.
 * On Windows this hands off to the (signed) installer and exits the process;
 * on macOS/Linux the binary is swapped in place, so we relaunch explicitly.
 */
export async function installAndRestart(ready: ReadyUpdate): Promise<void> {
  // Kill the sidecar FIRST so the installer can overwrite its files (see header).
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("prepare_update_install");
  } catch (e) {
    console.debug("prepare_update_install failed (continuing):", e);
  }
  await ready.update.install(); // Windows: spawns installer + exits this process
  // Only reached on macOS/Linux, where install() returns with the binary replaced.
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

/**
 * Install a previously downloaded update WITHOUT relaunching — used when the
 * user picked "install on next launch" and is now closing the app. On Windows
 * the installer runs as we exit; on macOS/Linux the binary is swapped so the
 * next launch is simply the new version.
 */
export async function installOnQuit(ready: ReadyUpdate): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("prepare_update_install");
  } catch {
    /* best effort */
  }
  await ready.update.install();
}
