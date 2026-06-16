export interface ApiSettings {
  queryApi: string;
  replayApi: string;
  proxyApi: string;
}

export const DEFAULT_SETTINGS: ApiSettings = {
  queryApi: "http://localhost:8081",
  replayApi: "http://localhost:8082",
  proxyApi: "http://localhost:8090",
};

const KEY = "refract.settings.v1";

export function loadSettings(): ApiSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: ApiSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("refract:settings-changed"));
}
