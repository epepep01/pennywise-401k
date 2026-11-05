import { chromeApi } from "./chrome";
import { hasReadAccess, revokeReadAccess, REVOKE_ALARM } from "./access";

// Opening the calculator does not grant any page-reading permission.
void chromeApi.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
chromeApi.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    // Keep the open call synchronous with the user gesture.
    void chromeApi.sidePanel.open({ tabId: tab.id }).catch(() => undefined);
  }
});

// Backup cleanup if the panel closes between a permission grant and its
// finally block. Alarms may be delayed during sleep; this is not a hard lease.
const revoke = () => {
  void revokeReadAccess().then(() => chromeApi.alarms.clear(REVOKE_ALARM)).catch(() => undefined);
};
chromeApi.permissions.onAdded.addListener(() => {
  void chromeApi.alarms.create(REVOKE_ALARM, { delayInMinutes: 1, periodInMinutes: 1 });
});
chromeApi.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REVOKE_ALARM) revoke();
});
chromeApi.runtime.onStartup.addListener(revoke);
chromeApi.runtime.onInstalled.addListener(revoke);
// Recreate the cleanup schedule whenever this worker starts, since older
// Chrome versions do not reliably retain alarms across browser sessions.
void hasReadAccess().then((granted) => {
  if (granted) return chromeApi.alarms.create(REVOKE_ALARM, { delayInMinutes: 1, periodInMinutes: 1 });
}).catch(() => undefined);
