import {
  MODULE_ID,
  getSetting,
  getFilterRules,
  ALL_DOCUMENT_TYPES,
  ALL_OPERATIONS,
  DEFAULT_FILTER_RULES,
} from './settings.js';

export class FilterConfigApp extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'foundry-webhook-filter-config',
      title: 'Foundry Webhook — Filter Rules',
      template: `modules/${MODULE_ID}/templates/filter-config.html`,
      width: 650,
      height: 'auto',
      closeOnSubmit: true,
    });
  }

  getData() {
    const rules = getFilterRules();
    const rulesMap = new Map(rules.map(r => [r.documentType, r]));

    const rows = ALL_DOCUMENT_TYPES.map(docType => {
      const rule = rulesMap.get(docType);
      const enabled = !!rule;
      const subtypesRaw = rule?.subtypes ?? ['*'];
      const isWildcard = subtypesRaw.includes('*');
      const subtypesText = isWildcard ? '' : subtypesRaw.join(', ');
      const ops = rule?.operations ?? [];

      return {
        documentType: docType,
        enabled,
        subtypesText,
        isWildcard,
        opCreate: ops.includes('create'),
        opUpdate: ops.includes('update'),
        opDelete: ops.includes('delete'),
        hasSubtypes: ['Actor', 'Item', 'JournalEntryPage', 'Cards'].includes(docType),
      };
    });

    return { rows, allOperations: ALL_OPERATIONS };
  }

  async _updateObject(event, formData) {
    const expanded = foundry.utils.expandObject(formData);
    const rules = [];

    for (const docType of ALL_DOCUMENT_TYPES) {
      const row = expanded[docType];

      if (!row?.enabled) {
        continue;
      }

      const operations = ALL_OPERATIONS.filter(op => row[`op_${op}`]);

      if (operations.length === 0) {
        continue;
      }

      let subtypes = ['*'];
      if (row.subtypes && row.subtypes.trim() !== '') {
        subtypes = row.subtypes.split(',').map(s => s.trim()).filter(Boolean);
      }

      rules.push({ documentType: docType, subtypes, operations });
    }

    await game.settings.set(MODULE_ID, 'filterRules', JSON.stringify(rules));
    ui.notifications.info('Foundry Webhook | Filter rules saved. Reload the world for changes to take effect.');
  }
}

export function registerFilterConfigButton() {
  game.settings.registerMenu(MODULE_ID, 'filterConfigMenu', {
    name: 'FOUNDRY_WEBHOOK.settings.filterConfig.name',
    label: 'FOUNDRY_WEBHOOK.settings.filterConfig.label',
    hint: 'FOUNDRY_WEBHOOK.settings.filterConfig.hint',
    icon: 'fas fa-filter',
    type: FilterConfigApp,
    restricted: true,
  });
}
