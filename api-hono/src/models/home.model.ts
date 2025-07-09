import { Entity } from 'electrodb';

export const HomeModel = new Entity({
  model: {
    entity: 'home',
    version: '1',
    service: 'cms',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
      default: 'home',
    },
    title: {
      type: 'string',
      required: false,
    },
    description: {
      type: 'string',
      required: false,
    },
    shortDescription: {
      type: 'string',
      required: false,
    },
    keywords: {
      type: 'string',
      required: false,
    },
    heroImageId: {
      type: 'string',
      required: false,
    },
    status: {
      type: ['draft', 'published'] as const,
      required: true,
      default: 'draft',
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
    publishedAt: {
      type: 'string',
      required: false,
    },
    createdBy: {
      type: 'string',
      required: false,
    },
    updatedBy: {
      type: 'string',
      required: false,
    },
  },
  indexes: {
    primary: {
      pk: {
        field: 'PK',
        composite: ['id'],
        template: 'HOME#${id}',
      },
      sk: {
        field: 'SK',
        composite: [],
        template: 'HOME',
      },
    },
  },
});