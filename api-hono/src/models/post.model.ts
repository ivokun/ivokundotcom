import { Entity } from 'electrodb';

export const PostModel = new Entity({
  model: {
    entity: 'post',
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
    content: {
      type: 'string',
      required: false,
    },
    richContent: {
      type: 'any',
      required: false,
    },
    excerpt: {
      type: 'string',
      required: false,
    },
    slug: {
      type: 'string',
      required: true,
    },
    readTimeMinute: {
      type: 'number',
      required: false,
    },
    featuredPictureId: {
      type: 'string',
      required: false,
    },
    categoryId: {
      type: 'string',
      required: false,
    },
    locale: {
      type: 'string',
      required: true,
      default: 'en',
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
        template: 'POST#${id}',
      },
      sk: {
        field: 'SK',
        composite: ['locale'],
        template: 'POST#${locale}',
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
        template: 'POST#${createdAt}',
      },
    },
    byStatus: {
      index: 'GSI3',
      pk: {
        field: 'GSI3PK',
        composite: ['status'],
        template: 'STATUS#${status}',
      },
      sk: {
        field: 'GSI3SK',
        composite: ['publishedAt'],
        template: 'POST#${publishedAt}',
      },
    },
  },
});