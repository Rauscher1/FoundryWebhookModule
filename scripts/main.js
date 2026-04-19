import { registerSettings } from './settings.js';
import { registerFilterConfigButton } from './filter-config.js';
import { registerHooks } from './hooks.js';

Hooks.once('init', () => {
  console.log('Foundry Webhook | Initializing module.');
  registerSettings();
  registerFilterConfigButton();
});

Hooks.once('ready', () => {
  registerHooks();
  console.log('Foundry Webhook | Ready.');
});
