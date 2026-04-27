export const MODULE_ID = 'foundry-webhook';

const DEFAULT_FILTER_RULES = [
  { documentType: 'Actor', subtypes: ['*'], operations: ['create', 'update', 'delete'] },
  { documentType: 'Item', subtypes: ['*'], operations: ['create', 'update', 'delete'] },
  { documentType: 'Scene', subtypes: ['*'], operations: ['create', 'update', 'delete'] },
  { documentType: 'JournalEntry', subtypes: ['*'], operations: ['create', 'update', 'delete'] },
  { documentType: 'JournalEntryPage', subtypes: ['*'], operations: ['create', 'update', 'delete'] },
  { documentType: 'RollTable', subtypes: ['*'], operations: ['create', 'update', 'delete'] },
  { documentType: 'Macro', subtypes: ['*'], operations: ['create', 'update', 'delete'] },
  { documentType: 'Cards', subtypes: ['*'], operations: ['create', 'update', 'delete'] },
  { documentType: 'Playlist', subtypes: ['*'], operations: ['create', 'update', 'delete'] },
];

const ALL_DOCUMENT_TYPES = [
  'Actor', 'Item', 'Scene', 'JournalEntry', 'JournalEntryPage',
  'RollTable', 'Macro', 'Cards', 'Playlist',
];

const ALL_OPERATIONS = ['create', 'update', 'delete'];

export function registerSettings() {
  game.settings.register(MODULE_ID, 'webhookUrl', {
    name: 'FOUNDRY_WEBHOOK.settings.webhookUrl.name',
    hint: 'FOUNDRY_WEBHOOK.settings.webhookUrl.hint',
    scope: 'world',
    config: true,
    type: String,
    default: '',
  });

  game.settings.register(MODULE_ID, 'apiSecret', {
    name: 'FOUNDRY_WEBHOOK.settings.apiSecret.name',
    hint: 'FOUNDRY_WEBHOOK.settings.apiSecret.hint',
    scope: 'world',
    config: true,
    type: String,
    default: '',
  });

  game.settings.register(MODULE_ID, 'debounceMs', {
    name: 'FOUNDRY_WEBHOOK.settings.debounceMs.name',
    hint: 'FOUNDRY_WEBHOOK.settings.debounceMs.hint',
    scope: 'world',
    config: true,
    type: Number,
    default: 2000,
    range: {
      min: 500,
      max: 10000,
      step: 500,
    },
  });

  game.settings.register(MODULE_ID, 'commandPollUrl', {
    name: 'FOUNDRY_WEBHOOK.settings.commandPollUrl.name',
    hint: 'FOUNDRY_WEBHOOK.settings.commandPollUrl.hint',
    scope: 'world',
    config: true,
    type: String,
    default: '',
  });

  game.settings.register(MODULE_ID, 'pollIntervalSeconds', {
    name: 'FOUNDRY_WEBHOOK.settings.pollIntervalSeconds.name',
    hint: 'FOUNDRY_WEBHOOK.settings.pollIntervalSeconds.hint',
    scope: 'world',
    config: true,
    type: Number,
    default: 10,
    range: {
      min: 5,
      max: 60,
      step: 5,
    },
  });

  game.settings.register(MODULE_ID, 'filterRules', {
    name: 'FOUNDRY_WEBHOOK.settings.filterRules.name',
    hint: 'FOUNDRY_WEBHOOK.settings.filterRules.hint',
    scope: 'world',
    config: false,
    type: String,
    default: JSON.stringify(DEFAULT_FILTER_RULES),
  });
}

export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

export function getFilterRules() {
  try {
    return JSON.parse(getSetting('filterRules'));
  } catch (e) {
    console.error('Foundry Webhook | Failed to parse filter rules, using defaults.', e);
    return DEFAULT_FILTER_RULES;
  }
}

export function getTrackedTypes() {
  return getFilterRules().map(r => r.documentType);
}

export function shouldTrackEvent(documentType, operation, document) {
  const rules = getFilterRules();
  const rule = rules.find(r => r.documentType === documentType);

  if (!rule) {
    return false;
  }

  if (!rule.operations.includes(operation)) {
    return false;
  }

  const subtype = document?.type ?? null;

  if (rule.subtypes.includes('*')) {
    return true;
  }

  if (subtype && !rule.subtypes.includes(subtype)) {
    return false;
  }

  return true;
}

export { ALL_DOCUMENT_TYPES, ALL_OPERATIONS, DEFAULT_FILTER_RULES };
