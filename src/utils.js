import { readFileSync } from "node:fs";
import { platform } from "node:os";

export const isMac = platform() === "darwin";
export const isLinux = platform() === "linux";

export const DEFAULT_PORT = parseInt(process.env.DEBUG_PORT) || 9222;

// Browser configurations per platform
export const BROWSERS = {
  chrome: {
    name: "Google Chrome",
    path: isMac
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "/usr/bin/google-chrome",
    process: "Google Chrome",
    profileSource: isMac
      ? `${process.env.HOME}/Library/Application Support/Google/Chrome/`
      : `${process.env.HOME}/.config/google-chrome/`,
  },
  brave: {
    name: "Brave",
    path: isMac
      ? "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
      : "/usr/bin/brave-browser",
    process: "Brave Browser",
    profileSource: isMac
      ? `${process.env.HOME}/Library/Application Support/BraveSoftware/Brave-Browser/`
      : `${process.env.HOME}/.config/BraveSoftware/Brave-Browser/`,
  },
  edge: {
    name: "Microsoft Edge",
    path: isMac
      ? "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
      : "/usr/bin/microsoft-edge",
    process: "Microsoft Edge",
    profileSource: isMac
      ? `${process.env.HOME}/Library/Application Support/Microsoft Edge/`
      : `${process.env.HOME}/.config/microsoft-edge/`,
  },
};

export function resolveProfileDir(profileSource, profileName) {
  // If it looks like a directory name already, use it
  if (profileName === "Default" || profileName.startsWith("Profile ")) {
    return profileName;
  }

  // Try to find profile by name in Local State
  if (profileSource) {
    try {
      const localStatePath = `${profileSource}Local State`;
      const localState = JSON.parse(readFileSync(localStatePath, "utf8"));
      const profiles = localState.profile?.info_cache || {};

      for (const [dir, info] of Object.entries(profiles)) {
        if (info.name?.toLowerCase() === profileName.toLowerCase()) {
          return dir;
        }
      }
    } catch {
      // Fall through to return original name
    }
  }

  return profileName;
}

export function parseProfileName(localState, profileName) {
  const profiles = localState.profile?.info_cache || {};

  for (const [dir, info] of Object.entries(profiles)) {
    if (info.name?.toLowerCase() === profileName.toLowerCase()) {
      return dir;
    }
  }

  return null;
}

export function normalizeUrl(url) {
  if (!url.match(/^https?:\/\//i)) {
    return "https://" + url;
  }
  return url;
}

export function filterRealPages(pages) {
  return pages.filter((p) => {
    const url = p.url();
    return url.startsWith("http://") || url.startsWith("https://");
  });
}

export function getActivePage(pages) {
  const realPages = filterRealPages(pages);
  return realPages[realPages.length - 1] || pages[pages.length - 1] || null;
}

export function formatTime() {
  return new Date().toISOString().split("T")[1].slice(0, 12);
}

// Console output colors
export const levelColors = {
  verbose: "\x1b[90m", // gray
  info: "\x1b[36m", // cyan
  warning: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
};

export const resetColor = "\x1b[0m";

export function formatLogEntry(level, source, text) {
  const color = levelColors[level] || levelColors.info;
  const sourceTag = source ? `[${source}]` : "";
  return `${color}[${formatTime()}] [${level.toUpperCase()}]${sourceTag} ${text}${resetColor}`;
}
