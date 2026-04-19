import { getTrackedTypes, shouldTrackEvent } from './settings.js';
import { queueEvent } from './webhook.js';

const OPERATIONS = ['create', 'update', 'delete'];

/**
 * Register hooks for all tracked document types.
 * Only the activeGM client will send webhooks to prevent duplicates.
 */
export function registerHooks() {
  const types = getTrackedTypes();

  for (const type of types) {
    for (const op of OPERATIONS) {
      const hookName = `${op}${type}`;
      Hooks.on(hookName, (...args) => onDocumentChange(op, type, args));
    }
  }

  console.log(`Foundry Webhook | Registered hooks for: ${types.join(', ')}`);
}

function isActiveGM() {
  return game.user === game.users.activeGM;
}

function onDocumentChange(operation, documentType, args) {
  if (!isActiveGM()) {
    return;
  }

  const [document, changeOrOptions, optionsOrUserId, maybeUserId] = args;

  if (!shouldTrackEvent(documentType, operation, document)) {
    return;
  }

  let changed = null;
  let userId = null;

  if (operation === 'update') {
    changed = changeOrOptions;
    userId = maybeUserId;
  } else {
    userId = optionsOrUserId;
  }

  const event = {
    operation,
    documentType,
    documentSubtype: document.type ?? null,
    documentId: document.id,
    documentName: document.name ?? null,
    uuid: document.uuid ?? null,
    userId,
    data: buildPayload(operation, document, changed),
  };

  queueEvent(event);
}

function buildPayload(operation, document, changed) {
  if (operation === 'delete') {
    return { id: document.id, name: document.name ?? null };
  }

  if (operation === 'update' && changed) {
    return {
      id: document.id,
      name: document.name ?? null,
      changed,
    };
  }

  // create — send the full source data
  return document.toObject();
}
