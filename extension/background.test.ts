import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it("opens the calculator without page access and installs backup permission cleanup", async () => {
  vi.resetModules();
  let onClick: ((tab: { id?: number }) => void) | undefined;
  let onAlarm: ((alarm: { name: string }) => void) | undefined;
  let onAdded: (() => void) | undefined;
  let onStartup: (() => void) | undefined;
  const open = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn().mockResolvedValue(true);
  const request = vi.fn();
  const setPanelBehavior = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("chrome", {
    sidePanel: { open, setPanelBehavior },
    action: { onClicked: { addListener: (callback: typeof onClick) => { onClick = callback; } } },
    permissions: { request, remove, contains: vi.fn().mockResolvedValue(false), onAdded: { addListener: (fn: () => void) => { onAdded = fn; } } },
    alarms: { create, clear: vi.fn().mockResolvedValue(true), onAlarm: { addListener: (fn: typeof onAlarm) => { onAlarm = fn; } } },
    runtime: { onStartup: { addListener: (fn: () => void) => { onStartup = fn; } }, onInstalled: { addListener: vi.fn() } },
  });
  await import("./background");
  expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: false });
  expect(open).not.toHaveBeenCalled();
  onClick?.({ id: 42 });
  expect(open).toHaveBeenCalledWith({ tabId: 42 });
  expect(request).not.toHaveBeenCalled();
  onClick?.({});
  expect(open).toHaveBeenCalledTimes(1);
  onAdded?.();
  expect(create).toHaveBeenCalledWith("expire-provider-access", { delayInMinutes: 1, periodInMinutes: 1 });
  onAlarm?.({ name: "expire-provider-access" });
  await vi.waitFor(() => expect(remove).toHaveBeenCalled());
  remove.mockClear();
  onStartup?.();
  await vi.waitFor(() => expect(remove).toHaveBeenCalled());
});
