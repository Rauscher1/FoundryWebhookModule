import { getSetting } from './settings.js';

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

let eventQueue = [];
let flushTimer = null;

/**
 * Queue an event for batched sending.
 */
export function queueEvent(event) {
  eventQueue.push(event);
  scheduleSend();
}

function scheduleSend() {
  if (flushTimer) {
    return;
  }

  const debounceMs = getSetting('debounceMs');
  flushTimer = setTimeout(() => flush(), debounceMs);
}

async function flush() {
  flushTimer = null;

  if (eventQueue.length === 0) {
    return;
  }

  const batch = [...eventQueue];
  eventQueue = [];

  await sendWithRetry(batch, 0);
}

async function sendWithRetry(batch, attempt) {
  const webhookUrl = getSetting('webhookUrl');

  if (!webhookUrl) {
    ui.notifications.warn(game.i18n.localize('FOUNDRY_WEBHOOK.notifications.noUrl'));
    return;
  }

  const payload = JSON.stringify({
    worldId: game.world.id,
    worldTitle: game.world.title,
    timestamp: new Date().toISOString(),
    events: batch,
  });

  const headers = {
    'Content-Type': 'application/json',
    'X-Foundry-World': game.world.id,
  };

  const secret = getSetting('apiSecret');
  if (secret) {
    const signature = await hmacSha256(secret, payload);
    headers['X-Foundry-Signature'] = signature;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: payload,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`Foundry Webhook | Sent ${batch.length} event(s) successfully.`);
  } catch (error) {
    console.error(`Foundry Webhook | Send failed (attempt ${attempt + 1}/${MAX_RETRIES}):`, error);

    if (attempt + 1 < MAX_RETRIES) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      setTimeout(() => sendWithRetry(batch, attempt + 1), delay);
      return;
    }

    ui.notifications.error(
      game.i18n.format('FOUNDRY_WEBHOOK.notifications.sendFailed', { attempts: MAX_RETRIES })
    );
  }
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
