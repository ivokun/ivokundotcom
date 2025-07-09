import { Entity } from 'electrodb';

export const UserModel = new Entity({
  model: {
    entity: 'user',
    version: '1',
    service: 'cms',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
    },
    email: {
      type: 'string',
      required: true,
    },
    firstName: {
      type: 'string',
      required: false,
    },
    lastName: {
      type: 'string',
      required: false,
    },
    username: {
      type: 'string',
      required: false,
    },
    provider: {
      type: 'string',
      required: true,
    },
    providerId: {
      type: 'string',
      required: true,
    },
    role: {
      type: ['admin', 'editor', 'author'] as const,
      required: true,
      default: 'author',
    },
    isActive: {
      type: 'boolean',
      required: true,
      default: true,
    },
    lastLogin: {
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
  },
  indexes: {
    primary: {
      pk: {
        field: 'PK',
        composite: ['id'],
        template: 'USER#${id}',
      },
      sk: {
        field: 'SK',
        composite: [],
        template: 'USER',
      },
    },
    byEmail: {
      index: 'GSI1',
      pk: {
        field: 'GSI1PK',
        composite: ['email'],
        template: 'EMAIL#${email}',
      },
      sk: {
        field: 'GSI1SK',
        composite: [],
        template: 'USER',
      },
    },
    byProvider: {
      index: 'GSI2',
      pk: {
        field: 'GSI2PK',
        composite: ['provider', 'providerId'],
        template: 'PROVIDER#${provider}#${providerId}',
      },
      sk: {
        field: 'GSI2SK',
        composite: [],
        template: 'USER',
      },
    },
  },
});