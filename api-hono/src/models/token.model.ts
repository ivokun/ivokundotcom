import { Entity } from 'electrodb';

export const TokenModel = new Entity({
  model: {
    entity: 'token',
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
    token: {
      type: 'string',
      required: true,
    },
    permissions: {
      type: 'list',
      items: {
        type: 'string',
      },
      required: true,
    },
    lastUsed: {
      type: 'string',
      required: false,
    },
    isActive: {
      type: 'boolean',
      required: true,
      default: true,
    },
    expiresAt: {
      type: 'string',
      required: false,
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
        template: 'TOKEN#${id}',
      },
      sk: {
        field: 'SK',
        composite: [],
        template: 'TOKEN',
      },
    },
    byToken: {
      index: 'GSI1',
      pk: {
        field: 'GSI1PK',
        composite: ['token'],
        template: 'TOKEN_VALUE#${token}',
      },
      sk: {
        field: 'GSI1SK',
        composite: [],
        template: 'TOKEN',
      },
    },
  },
});