import { Entity } from 'electrodb';

export const WebhookModel = new Entity({
  model: {
    entity: 'webhook',
    version: '1',
    service: 'cms',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
    },
    name: {
      type: 'string',
      required: true,
    },
    url: {
      type: 'string',
      required: true,
    },
    events: {
      type: 'list',
      items: {
        type: 'string',
      },
      required: true,
    },
    headers: {
      type: 'map',
      properties: {},
      required: false,
    },
    isActive: {
      type: 'boolean',
      required: true,
      default: true,
    },
    lastTriggered: {
      type: 'string',
      required: false,
    },
    failureCount: {
      type: 'number',
      required: true,
      default: 0,
    },
    createdAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
    },
    updatedAt: {
      type: 'string',
      required: true,
      default: () => new Date().toISOString(),
      watch: '*',
      set: () => new Date().toISOString(),
    },
    createdBy: {
      type: 'string',
      required: false,
    },
  },
  indexes: {
    primary: {
      pk: {
        field: 'PK',
        composite: ['id'],
        template: 'WEBHOOK#${id}',
      },
      sk: {
        field: 'SK',
        composite: [],
        template: 'WEBHOOK',
      },
    },
  },
});