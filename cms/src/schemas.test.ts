import { Schema } from 'effect';
import { describe, expect, test } from 'bun:test';

import * as S from './schemas';

describe('Schema Validation', () => {
  describe('Primitives', () => {
    test('Slug validates correctly', () => {
      const decode = Schema.decodeUnknownSync(S.Slug);
      
      expect(decode('hello-world')).toBe('hello-world' as S.Slug);
      expect(decode('my-post-123')).toBe('my-post-123' as S.Slug);
      expect(() => decode('Hello World')).toThrow(); // spaces/caps
      expect(() => decode('')).toThrow(); // empty
      expect(() => decode('--double')).toThrow(); // double dash
    });

    test('Email validates correctly', () => {
      const decode = Schema.decodeUnknownSync(S.Email);
      
      expect(decode('test@example.com')).toBe('test@example.com' as S.Email);
      expect(() => decode('invalid')).toThrow();
      expect(() => decode('no@domain')).toThrow();
    });

    test('Locale only accepts en/id', () => {
      const decode = Schema.decodeUnknownSync(S.Locale);
      
      expect(decode('en')).toBe('en');
      expect(decode('id')).toBe('id');
      expect(() => decode('fr')).toThrow();
    });

    test('Status only accepts draft/published', () => {
      const decode = Schema.decodeUnknownSync(S.Status);
      
      expect(decode('draft')).toBe('draft');
      expect(decode('published')).toBe('published');
      expect(() => decode('pending')).toThrow();
    });
  });

  describe('Category', () => {
    test('CreateCategoryInput validates', () => {
      const decode = Schema.decodeUnknownSync(S.CreateCategoryInput);
      
      const valid = decode({
        name: 'Technology',
        slug: 'technology',
        description: 'Tech posts',
      });
      
      expect(valid.name).toBe('Technology');
      expect(valid.slug).toBe('technology' as S.Slug);
    });

    test('CreateCategoryInput rejects invalid slug', () => {
      const decode = Schema.decodeUnknownSync(S.CreateCategoryInput);
      
      expect(() =>
        decode({
          name: 'Technology',
          slug: 'Invalid Slug',
        })
      ).toThrow();
    });
  });

  describe('Post', () => {
    test('CreatePostInput with defaults', () => {
      const decode = Schema.decodeUnknownSync(S.CreatePostInput);
      
      const result = decode({
        title: 'My Post',
        slug: 'my-post',
      });
      
      expect(result.title).toBe('My Post');
      expect(result.locale).toBe('en'); // default
    });

    test('PostListQueryParams with defaults', () => {
      const decode = Schema.decodeUnknownSync(S.PostListQueryParams);
      
      const result = decode({});
      
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });
  });

  describe('TipTap Document', () => {
    test('validates basic document', () => {
      const decode = Schema.decodeUnknownSync(S.TipTapDocument);
      
      const doc = decode({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello world' }],
          },
        ],
      });
      
      expect(doc.type).toBe('doc');
      expect(doc.content).toHaveLength(1);
    });
  });
});
