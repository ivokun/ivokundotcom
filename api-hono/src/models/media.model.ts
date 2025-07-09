import { Entity } from 'electrodb';

export const MediaModel = new Entity({
  model: {
    entity: 'media',
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
    alternativeText: {
      type: 'string',
      required: false,
    },
    caption: {
      type: 'string',
      required: false,
    },
    width: {
      type: 'number',
      required: false,
    },
    height: {
      type: 'number',
      required: false,
    },
    url: {
      type: 'string',
      required: true,
    },
    formats: {
      type: 'map',
      properties: {
        thumbnail: {
          type: 'map',
          properties: {
            url: { type: 'string' },
            width: { type: 'number' },
            height: { type: 'number' },
            size: { type: 'number' },
          },
        },
        small: {
          type: 'map',
          properties: {
            url: { type: 'string' },
            width: { type: 'number' },
            height: { type: 'number' },
            size: { type: 'number' },
          },
        },
        medium: {
          type: 'map',
          properties: {
            url: { type: 'string' },
            width: { type: 'number' },
            height: { type: 'number' },
            size: { type: 'number' },
          },
        },
        large: {
          type: 'map',
          properties: {
            url: { type: 'string' },
            width: { type: 'number' },
            height: { type: 'number' },
            size: { type: 'number' },
          },
        },
      },
    },
    hash: {
      type: 'string',
      required: true,
    },
    ext: {
      type: 'string',
      required: true,
    },
    mime: {
      type: 'string',
      required: true,
    },
    size: {
      type: 'number',
      required: true,
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
        template: 'MEDIA#${id}',
      },
      sk: {
        field: 'SK',
        composite: [],
        template: 'MEDIA',
      },
    },
  },
});