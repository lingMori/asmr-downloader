import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import {
  loadSettings,
  resolveTheme,
  SettingsProvider,
  useSettings,
  SETTINGS_STORAGE_KEY,
} from "./settings";

function mockMatchMedia(lightMatches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: lightMatches,
    media: "(prefers-color-scheme: light)",
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
      listeners.delete(cb),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return {
    fire(matches: boolean) {
      (mql as { matches: boolean }).matches = matches;
      listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent));
    },
  };
}

function Probe() {
  const { settings, resolvedTheme, update } = useSettings();
  return (
    <div>
      <span data-testid="theme">{settings.theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <span data-testid="palette">{settings.palette}</span>
      <span data-testid="stickers">{String(settings.stickers)}</span>
      <button onClick={() => update({ theme: "light" })}>to-light</button>
      <button onClick={() => update({ palette: "blue", stickers: false })}>blue-no-stickers</button>
    </div>
  );
}

describe("settings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockMatchMedia(false);
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.palette;
    delete document.documentElement.dataset.stickers;
  });

  it("loadSettings falls back to defaults on empty/garbage storage", () => {
    expect(loadSettings()).toEqual({
      theme: "dark",
      palette: "lavender",
      stickers: true,
      notify: false,
    });
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, "{not json");
    expect(loadSettings().theme).toBe("dark");
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ theme: "neon", palette: "pink", stickers: 0, notify: 1 }),
    );
    expect(loadSettings()).toEqual({
      theme: "dark",
      palette: "lavender",
      stickers: true,
      notify: false,
    });
  });

  it("loadSettings keeps valid stored values", () => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ theme: "light", palette: "green", stickers: false, notify: true }),
    );
    expect(loadSettings()).toEqual({
      theme: "light",
      palette: "green",
      stickers: false,
      notify: true,
    });
  });

  it("resolveTheme resolves system via matchMedia", () => {
    mockMatchMedia(true);
    expect(resolveTheme("system")).toBe("light");
    mockMatchMedia(false);
    expect(resolveTheme("system")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
  });

  it("provider writes dataset + persists updates to localStorage", () => {
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.palette).toBe("lavender");
    expect(document.documentElement.dataset.stickers).toBe("true");

    act(() => screen.getByText("to-light").click());
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toMatchObject({
      theme: "light",
    });

    act(() => screen.getByText("blue-no-stickers").click());
    expect(document.documentElement.dataset.palette).toBe("blue");
    expect(document.documentElement.dataset.stickers).toBe("false");
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toMatchObject({
      palette: "blue",
      stickers: false,
    });
  });

  it("system theme re-resolves on matchMedia change", () => {
    const media = mockMatchMedia(false);
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ theme: "system" }));
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => media.fire(true));
    expect(screen.getByTestId("resolved").textContent).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
