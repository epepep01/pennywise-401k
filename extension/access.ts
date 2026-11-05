import { chromeApi } from "./chrome";

export const READ_ACCESS = {
  permissions: ["scripting"],
  origins: ["https://workplaceservices.fidelity.com/*"],
};
export const REVOKE_ALARM = "expire-provider-access";

export async function hasReadAccess(): Promise<boolean> {
  return await chromeApi.permissions.contains({ permissions: ["scripting"], origins: [] }) ||
    await chromeApi.permissions.contains({ permissions: [], origins: READ_ACCESS.origins });
}

export function isContributionUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      url.hostname === "workplaceservices.fidelity.com" && url.port === "" &&
      /^\/mybenefits\/dcnav\/pages\/contributions\/?$/.test(url.pathname) &&
      url.search === "" && ["", "#", "#/", "#/landing"].includes(url.hash);
  } catch { return false; }
}

export async function revokeReadAccess(): Promise<void> {
  await chromeApi.permissions.remove(READ_ACCESS);
  // Confirm both privileges were removed, including a partial failure.
  for (const access of [
    { permissions: ["scripting"], origins: [] },
    { permissions: [], origins: READ_ACCESS.origins },
  ]) {
    if (await chromeApi.permissions.contains(access)) {
      throw new Error("Provider access could not be removed. Disable Pennywise in Chrome before continuing.");
    }
  }
}
