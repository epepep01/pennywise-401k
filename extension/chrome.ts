// Only the extension APIs used here; no Chrome globals leak into the web app.
export const chromeApi = (globalThis as unknown as {
  chrome: {
    action: { onClicked: { addListener(callback: (tab: { id?: number }) => void): void } };
    sidePanel: {
      setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void>;
      open(options: { tabId: number }): Promise<void>;
    };
    tabs: {
      query(options: { active: boolean; currentWindow: boolean }): Promise<{ id?: number; url?: string }[]>;
      onActivated: { addListener(callback: () => void): void };
      onUpdated: { addListener(callback: () => void): void };
    };
    scripting: {
      executeScript<T>(options: { target: { tabId: number }; world: "ISOLATED"; func: () => T }): Promise<{ result?: T; frameId: number }[]>;
    };
    permissions: {
      request(options: { permissions: string[]; origins: string[] }): Promise<boolean>;
      remove(options: { permissions: string[]; origins: string[] }): Promise<boolean>;
      contains(options: { permissions: string[]; origins: string[] }): Promise<boolean>;
      onAdded: { addListener(callback: () => void): void };
    };
    alarms: {
      create(name: string, options: { delayInMinutes: number; periodInMinutes?: number }): Promise<void>;
      clear(name: string): Promise<boolean>;
      onAlarm: { addListener(callback: (alarm: { name: string }) => void): void };
    };
    runtime: {
      onStartup: { addListener(callback: () => void): void };
      onInstalled: { addListener(callback: () => void): void };
    };
  };
}).chrome;
