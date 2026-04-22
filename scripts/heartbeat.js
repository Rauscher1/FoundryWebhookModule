import { getSetting } from './settings.js';

/**
 * Send a lifecycle heartbeat to the configured webhook endpoint.
 * Two event types are supported:
 *   - "worldStart" — dispatched once the world is fully ready.
 *   - "worldStop"  — dispatched when the GM's browser tab is about to unload
 *                     (tab close, navigation, or game.shutDown()).
 *
 * The "worldStop" signal uses fetch() with keepalive: true so it survives page
 * unload while still supporting custom headers (unlike sendBeacon).
 * The stop payload and HMAC signature are pre-computed on each heartbeat tick
 * so the beforeunload handler stays fully synchronous.
 */

const HEARTBEAT_TYPE_START = 'worldStart';
const HEARTBEAT_TYPE_STOP = 'worldStop';

function isActiveGM() {
  return game.user === game.users.activeGM;
}

function buildHeartbeatPayload(type) {
  return {
    worldId: game.world.id,
    worldTitle: game.world.title,
    timestamp: new Date().toISOString(),
    heartbeat: type,
  };
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

// Pre-built stop request so the beforeunload handler is fully synchronous.
let preparedStopRequest = null;

async function sendHeartbeat(type) {
  const webhookUrl = getSetting('webhookUrl');

  if (!webhookUrl) {
    return;
  }

  const body = JSON.stringify(buildHeartbeatPayload(type));
  const headers = await buildHeaders(body);

  try {
    const response = await fetch(webhookUrl, { method: 'POST', headers, body });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`Foundry Webhook | Heartbeat "${type}" sent.`);
  } catch (error) {
    console.error('Foundry Webhook | Heartbeat send failed:', error);
  }
}

async function buildHeaders(body) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Foundry-World': game.world.id,
  };

  const secret = getSetting('apiSecret');
  if (secret) {
    headers['X-Foundry-Signature'] = await hmacSha256(secret, body);
  }

  return headers;
}

async function prepareStopHeartbeat() {
  const webhookUrl = getSetting('webhookUrl');

  if (!webhookUrl) {
    preparedStopRequest = null;
    return;
  }

  const body = JSON.stringify(buildHeartbeatPayload(HEARTBEAT_TYPE_STOP));
  const headers = await buildHeaders(body);

  preparedStopRequest = { url: webhookUrl, headers, body };
}

function sendStopHeartbeat() {
  if (!preparedStopRequest) {
    return;
  }

  const { url, headers, body } = preparedStopRequest;

  // keepalive: true ensures the request survives page unload, similar to sendBeacon
  // but with full custom header support.
  fetch(url, { method: 'POST', headers, body, keepalive: true }).catch(() => {});
}

/**
 * Call once from the "ready" hook.
 * Registers the start heartbeat and the beforeunload listener for the stop heartbeat.
 */
export async function initHeartbeat() {
  if (!isActiveGM()) {
    return;
  }

  await sendHeartbeat(HEARTBEAT_TYPE_START);
  await prepareStopHeartbeat();

  window.addEventListener('beforeunload', () => {
    sendStopHeartbeat();
  });

  console.log('Foundry Webhook | Heartbeat listeners registered.');
}
