import { describe, expect, test } from 'bun:test';

import * as Errors from './errors';

describe('Error System', () => {
  test('NotFound generates correct message', () => {
    const error = new Errors.NotFound({ resource: 'Post', id: 'abc123' });
    expect(error.message).toBe("Post with id abc123 not found");
    expect(error._tag).toBe('NotFound');
  });

  test('SlugConflict includes locale when provided', () => {
    const error = new Errors.SlugConflict({ slug: 'my-post', locale: 'en' });
    expect(error.message).toBe("Slug 'my-post' for locale 'en' already exists");
  });

  test('SlugConflict without locale', () => {
    const error = new Errors.SlugConflict({ slug: 'my-post' });
    expect(error.message).toBe("Slug 'my-post' already exists");
  });

  test('Unauthorized generates correct message', () => {
    const error = new Errors.Unauthorized({ action: 'delete', resource: 'Post' });
    expect(error.message).toBe('User not authorized to perform delete on Post');
  });

  test('Unauthorized without resource', () => {
    const error = new Errors.Unauthorized({ action: 'access' });
    expect(error.message).toBe('User not authorized to perform access');
  });

  test('ValidationError generates correct message', () => {
    const error = new Errors.ValidationError({
      errors: [
        { path: 'title', message: 'Required' },
        { path: 'slug', message: 'Must be unique' },
      ],
    });
    expect(error.message).toBe('Validation failed: title: Required, slug: Must be unique');
  });

  test('toHttpStatus maps correctly', () => {
    expect(Errors.toHttpStatus(new Errors.NotFound({ resource: 'Post', id: '1' }))).toBe(404);
    expect(Errors.toHttpStatus(new Errors.InvalidCredentials({}))).toBe(401);
    expect(Errors.toHttpStatus(new Errors.SessionExpired({}))).toBe(401);
    expect(Errors.toHttpStatus(new Errors.InvalidApiKey({}))).toBe(401);
    expect(Errors.toHttpStatus(new Errors.Unauthorized({ action: 'test' }))).toBe(403);
    expect(Errors.toHttpStatus(new Errors.SlugConflict({ slug: 'x' }))).toBe(409);
    expect(
      Errors.toHttpStatus(new Errors.ValidationError({ errors: [] }))
    ).toBe(400);
    expect(
      Errors.toHttpStatus(new Errors.DatabaseError({ cause: null, operation: 'test' }))
    ).toBe(500);
    expect(
      Errors.toHttpStatus(new Errors.StorageError({ cause: null, operation: 'test' }))
    ).toBe(500);
    expect(
      Errors.toHttpStatus(new Errors.ImageProcessingError({ cause: null }))
    ).toBe(500);
    expect(Errors.toHttpStatus(new Errors.ConfigError({ message: 'test' }))).toBe(500);
  });

  test('toJsonResponse includes correct fields for NotFound', () => {
    const response = Errors.toJsonResponse(
      new Errors.NotFound({ resource: 'Post', id: 'xyz' })
    );
    expect(response).toEqual({
      error: 'NotFound',
      message: 'Post with id xyz not found',
    });
  });

  test('toJsonResponse includes details for ValidationError', () => {
    const response = Errors.toJsonResponse(
      new Errors.ValidationError({
        errors: [{ path: 'title', message: 'Required' }],
      })
    );
    expect(response.error).toBe('ValidationError');
    expect(response.details).toHaveLength(1);
  });

  test('type guards work correctly', () => {
    const auth = new Errors.InvalidCredentials({});
    const resource = new Errors.NotFound({ resource: 'X', id: '1' });
    const infra = new Errors.DatabaseError({ cause: null, operation: 'test' });

    expect(Errors.isAuthError(auth)).toBe(true);
    expect(Errors.isAuthError(resource)).toBe(false);

    expect(Errors.isResourceError(resource)).toBe(true);
    expect(Errors.isResourceError(auth)).toBe(false);

    expect(Errors.isInfraError(infra)).toBe(true);
    expect(Errors.isInfraError(auth)).toBe(false);

    expect(Errors.isAppError(auth)).toBe(true);
    expect(Errors.isAppError(resource)).toBe(true);
    expect(Errors.isAppError(infra)).toBe(true);
    expect(Errors.isAppError(new Error('random'))).toBe(false);
  });
});
