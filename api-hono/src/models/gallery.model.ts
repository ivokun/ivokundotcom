import { Entity } from 'electrodb';

export const GalleryModel = new Entity({
  model: {
    entity: 'gallery',
    version: '1',
    service: 'cms',
  },
  attributes: {
    id: {
      type: 'string',
      required: true,
    },
    title: {
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
    imageIds: {
      type: 'list',
      items: {
        type: 'string',
      },
      required: false,
    },
    categoryId: {
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
        template: 'GALLERY#${id}',
      },
      sk: {
        field: 'SK',
        composite: [],
        template: 'GALLERY',
      },
    },
    byCategory: {
      index: 'GSI1',
      pk: {
        field: 'GSI1PK',
        composite: ['categoryId'],
        template: 'CATEGORY#${categoryId}',
      },
      sk: {
        field: 'GSI1SK',
        composite: ['createdAt'],
        template: 'GALLERY#${createdAt}',
      },
    },
  },
});