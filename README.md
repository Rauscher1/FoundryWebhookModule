# Foundry Webhook Module

A Foundry VTT module that sends real-time webhook notifications to an external API whenever documents are created, updated, or deleted.

Instead of polling Foundry on a cron schedule, install this module and receive push notifications the instant something changes.

## Features

- **Real-time push** — hooks into Foundry's document lifecycle (`create`, `update`, `delete`)
- **Tracks all document types** — Actors, Items, Scenes, Journals, Journal Pages, Roll Tables, Macros, Cards, Playlists (configurable)
- **Granular filtering** — configure per-document-type which subtypes (e.g. `character` vs `npc`) and which operations (create/update/delete) to track
- **Single sender** — uses `game.users.activeGM` to ensure only one connected client sends webhooks, even with multiple GMs
- **Batched & debounced** — collects rapid changes and sends them in a single request
- **HMAC-SHA256 signed** — requests include an `X-Foundry-Signature` header so your API can verify authenticity
- **Retry with backoff** — failed requests are retried up to 3 times with exponential backoff

## Installation

### Via Manifest URL (recommended)

1. In Foundry VTT, go to **Add-on Modules** → **Install Module**
2. Paste the manifest URL into the **Manifest URL** field:
   ```
   https://github.com/rauscher/foundry-webhook-module/releases/latest/download/module.json
   ```
3. Click **Install**

### Manual Installation

1. Download the latest release zip
2. Extract it into your Foundry `Data/modules/` directory so the structure is:
   ```
   Data/modules/foundry-webhook/
   ├── module.json
   ├── scripts/
   ├── lang/
   └── ...
   ```
3. Restart Foundry VTT

## Configuration

After installing, activate the module in your world and configure it in **Module Settings**:

| Setting | Description |
|---------|-------------|
| **Webhook URL** | The endpoint where events are POSTed (e.g. `https://yoursite.com/api/foundry/webhook`) |
| **API Secret** | Shared secret for HMAC-SHA256 signature generation |
| **Debounce Interval** | Milliseconds to wait before sending batched events (default: 2000) |
| **Configure Filters** | Opens the filter configuration UI (see below) |

### Filter Configuration

Click **Configure Filters** in Module Settings to open a visual editor where you can control exactly what gets sent:

| Column | Description |
|--------|-------------|
| **Enabled** | Whether this document type is tracked at all |
| **Document Type** | Actor, Item, Scene, JournalEntry, etc. |
| **Subtypes** | Comma-separated list of subtypes to track. Leave empty for all. Subtypes are system-specific — e.g. in D&D 5e, Actors have `character` and `npc` subtypes |
| **Create / Update / Delete** | Which operations to track per type |

**Examples:**
- Track only player characters, not NPCs → enable Actor, set subtypes to `character`, check all operations
- Track journal updates only (no create/delete) → enable JournalEntryPage, leave subtypes empty, check only Update
- Ignore scenes entirely → uncheck Enabled for Scene

## Webhook Payload

Each POST request contains a JSON body with the following structure:

```json
{
  "worldId": "my-world",
  "worldTitle": "My World",
  "timestamp": "2025-04-19T13:00:00.000Z",
  "events": [
    {
      "operation": "update",
      "documentType": "Actor",
      "documentSubtype": "character",
      "documentId": "abc123",
      "documentName": "Gandalf",
      "uuid": "Actor.abc123",
      "userId": "xyz789",
      "data": {
        "id": "abc123",
        "name": "Gandalf",
        "changed": {
          "system": {
            "attributes": {
              "hp": {
                "value": 42
              }
            }
          }
        }
      }
    }
  ]
}
```

### Event operations

- **create** — `data` contains the full document source data (`document.toObject()`)
- **update** — `data.changed` contains only the differential (e.g. just the HP field that changed)
- **delete** — `data` contains `{ id, name }` of the deleted document

## Verifying Signatures

If you configure an **API Secret**, each request includes an `X-Foundry-Signature` header containing an HMAC-SHA256 hex digest of the request body.

### PHP example

```php
$payload = file_get_contents('php://input');
$secret = 'your-shared-secret';
$expected = hash_hmac('sha256', $payload, $secret);
$received = $_SERVER['HTTP_X_FOUNDRY_SIGNATURE'] ?? '';

if (!hash_equals($expected, $received)) {
    http_response_code(401);
    exit('Invalid signature');
}

$data = json_decode($payload, true);
// Process events...
```

## What Gets Captured

This module captures **all** document changes routed through Foundry's hook system:

- ✅ HP changes on actors (player or GM initiated)
- ✅ Item quantity/charge changes
- ✅ Journal page text edits
- ✅ Scene configuration changes
- ✅ New actors/items/scenes created
- ✅ Documents deleted
- ✅ Any tracked document type's CRUD operations
- ✅ Filterable by subtype (e.g. only `character` actors, not `npc`)

## Compatibility

- **Foundry VTT**: V11, V12, V13, V14
- **Systems**: System-agnostic (works with any game system)

## License

MIT
