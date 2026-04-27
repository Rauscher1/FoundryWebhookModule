import { getSetting } from './settings.js';

/**
 * Polls an external endpoint for inbound commands (create, update, delete)
 * and executes them against Foundry's document API.
 *
 * Expected response from the poll endpoint:
 * {
 *   "commands": [
 *     {
 *       "id": "cmd-unique-id",
 *       "operation": "create" | "update" | "delete",
 *       "documentType": "Actor" | "Item" | "JournalEntry" | ...,
 *       "documentId": null | "existing-id",  // null for create
 *       "data": { ... },                      // full document data for create/update
 *       "options": { ... }                    // optional Foundry options
 *     }
 *   ]
 * }
 *
 * After processing, results are POSTed back to the same URL:
 * {
 *   "results": [
 *     { "commandId": "cmd-unique-id", "status": "ok", "documentId": "created-id" },
 *     { "commandId": "cmd-unique-id", "status": "error", "error": "..." }
 *   ]
 * }
 */

const DOCUMENT_CLASSES = {
  Actor: () => Actor,
  Item: () => Item,
  Scene: () => Scene,
  JournalEntry: () => JournalEntry,
  JournalEntryPage: () => JournalEntryPage,
  RollTable: () => RollTable,
  Macro: () => Macro,
  Cards: () => Cards,
  Playlist: () => Playlist,
};

let pollTimer = null;

function isActiveGM() {
  return game.user === game.users.activeGM;
}

async function hmacSha256(secret, message) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function buildHeaders(body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Foundry-World': game.world.id,
  };

  const secret = getSetting('apiSecret');
  if (secret && body) {
    headers['X-Foundry-Signature'] = await hmacSha256(secret, body);
  }

  return headers;
}

async function fetchCommands() {
  const pollUrl = getSetting('commandPollUrl');

  if (!pollUrl) {
    return [];
  }

  try {
    const headers = await buildHeaders();
    const response = await fetch(pollUrl, { method: 'GET', headers });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    return json.commands ?? [];
  } catch (error) {
    console.error('Foundry Webhook | Command poll failed:', error);
    return [];
  }
}

async function acknowledgeResults(results) {
  const pollUrl = getSetting('commandPollUrl');

  if (!pollUrl || results.length === 0) {
    return;
  }

  const body = JSON.stringify({
    worldId: game.world.id,
    timestamp: new Date().toISOString(),
    results,
  });

  try {
    const headers = await buildHeaders(body);
    await fetch(pollUrl, { method: 'POST', headers, body });
  } catch (error) {
    console.error('Foundry Webhook | Failed to acknowledge command results:', error);
  }
}

async function executeCommand(command) {
  const { id: commandId, operation, documentType, documentId, data, options } = command;

  const classGetter = DOCUMENT_CLASSES[documentType];
  if (!classGetter) {
    return { commandId, status: 'error', error: `Unknown document type: ${documentType}` };
  }

  const DocumentClass = classGetter();

  try {
    switch (operation) {
      case 'create': {
        const created = await DocumentClass.create(data, options ?? {});
        console.log(`Foundry Webhook | Created ${documentType} "${created.name}" (${created.id})`);
        return { commandId, status: 'ok', documentId: created.id };
      }

      case 'update': {
        const doc = game[DocumentClass.metadata.collection]?.get(documentId)
          ?? await DocumentClass.get(documentId);

        if (!doc) {
          return { commandId, status: 'error', error: `${documentType} ${documentId} not found` };
        }

        await doc.update(data, options ?? {});
        console.log(`Foundry Webhook | Updated ${documentType} "${doc.name}" (${doc.id})`);
        return { commandId, status: 'ok', documentId: doc.id };
      }

      case 'delete': {
        const doc = game[DocumentClass.metadata.collection]?.get(documentId)
          ?? await DocumentClass.get(documentId);

        if (!doc) {
          return { commandId, status: 'error', error: `${documentType} ${documentId} not found` };
        }

        await doc.delete(options ?? {});
        console.log(`Foundry Webhook | Deleted ${documentType} "${doc.name}" (${documentId})`);
        return { commandId, status: 'ok', documentId };
      }

      default:
        return { commandId, status: 'error', error: `Unknown operation: ${operation}` };
    }
  } catch (error) {
    console.error(`Foundry Webhook | Command ${commandId} failed:`, error);
    return { commandId, status: 'error', error: error.message };
  }
}

async function pollCycle() {
  if (!isActiveGM()) {
    return;
  }

  const commands = await fetchCommands();

  if (commands.length === 0) {
    return;
  }

  console.log(`Foundry Webhook | Processing ${commands.length} inbound command(s).`);

  const results = [];
  for (const command of commands) {
    const result = await executeCommand(command);
    results.push(result);
  }

  await acknowledgeResults(results);
}

export function initCommandPoller() {
  if (!isActiveGM()) {
    return;
  }

  const pollUrl = getSetting('commandPollUrl');
  if (!pollUrl) {
    console.log('Foundry Webhook | No command poll URL configured, skipping poller.');
    return;
  }

  const intervalSeconds = getSetting('pollIntervalSeconds');
  pollTimer = setInterval(() => pollCycle(), intervalSeconds * 1000);

  // Run first poll immediately.
  pollCycle();

  console.log(`Foundry Webhook | Command poller started (every ${intervalSeconds}s).`);
}

export function stopCommandPoller() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
