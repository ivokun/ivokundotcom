import { Entity } from 'electrodb';

export const CategoryModel = new Entity({
  model: {
    entity: 'category',
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
    description: {
      type: 'string',
      required: false,
    },
    slug: {
      type: 'string',
      required: true,
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
        template: 'CATEGORY#${id}',
      },
      sk: {
        field: 'SK',
        composite: [],
        template: 'CATEGORY',
      },
    },
  },
});