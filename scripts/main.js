import { registerSettings } from './settings.js';
import { registerFilterConfigButton } from './filter-config.js';
import { registerHooks } from './hooks.js';
import { initHeartbeat } from './heartbeat.js';
import { initCommandPoller } from './command-poller.js';

Hooks.once('init', () => {
  console.log('Foundry Webhook | Initializing module.');
  registerSettings();
  registerFilterConfigButton();
});

Hooks.once('ready', () => {
  registerHooks();
  initHeartbeat();
  initCommandPoller();
  console.log('Foundry Webhook | Ready.');
});
