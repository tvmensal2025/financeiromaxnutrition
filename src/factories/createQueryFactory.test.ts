/**
 * Query Factory Tests
 * 
 * Tests for the generic query factory implementation to ensure it generates
 * consistent, type-safe query hooks for any entity type.
 * 
 * @fileoverview Query factory tests
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createQueryFactory } from './createQueryFactory';
import { BaseEntity } from './types/core';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id', name: 'Test' }, error: null })),
          range: vi.fn(() => Promise.resolve({ data: [{ id: 'test-id', name: 'Test' }], error: null, count: 1 }))
        })),
        range: vi.fn(() => Promise.resolve({ data: [{ id: 'test-id', name: 'Test' }], error: null, count: 1 })),
        order: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: 'test-id', name: 'Test' }, error: null }))
          }))
        }))
      }))
    }))
  }
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    business: { id: 'test-business-id' }
  }))
}));

// Test entity interface
interface TestEntity extends BaseEntity {
  name: string;
  email?: string;
}

// Test wrapper component
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) => {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe('Query Factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Factory Creation', () => {
    it('should create a query factory with all required methods', () => {
      const factory = createQueryFactory<TestEntity>({
        tableName: 'test_entities'
      });

      expect(factory).toHaveProperty('useEntities');
      expect(factory).toHaveProperty('useEntity');
      expect(factory).toHaveProperty('useEntitiesInfinite');
      expect(factory).toHaveProperty('useEntitiesCount');
      expect(factory).toHaveProperty('getTableName');
      expect(factory).toHaveProperty('getConfig');
      expect(factory).toHaveProperty('getQueryKey');
    });

    it('should return correct table name', () => {
      const factory = createQueryFactory<TestEntity>({
        tableName: 'test_entities'
      });

      expect(factory.getTableName()).toBe('test_entities');
    });

    it('should return factory configuration', () => {
      const config = {
        tableName: 'test_entities',
        defaultPageSize: 25,
        realTimeSubscription: true
      };

      const factory = createQueryFactory<TestEntity>(config);
      expect(factory.getConfig()).toEqual(config);
    });
  });

  describe('Query Key Generation', () => {
    it('should generate consistent query keys', () => {
      const factory = createQueryFactory<TestEntity>({
        tableName: 'test_entities'
      });

      const key1 = factory.getQueryKey('list');
      const key2 = factory.getQueryKey('list');
      
      expect(key1).toEqual(key2);
      expect(key1).toEqual(['test_entities', 'list']);
    });

    it('should include filters in query keys', () => {
      const factory = createQueryFactory<TestEntity>({
        tableName: 'test_entities'
      });

      const filters = { where: { active: true } };
      const key = factory.getQueryKey('list', filters);
      
      expect(key).toEqual(['test_entities', 'list', JSON.stringify(filters)]);
    });
  });

  describe('Hook Generation', () => {
    it('should generate useEntities hook', () => {
      const factory = createQueryFactory<TestEntity>({
        tableName: 'test_entities'
      });
      const wrapper = createWrapper();

      const { result } = renderHook(() => factory.useEntities(), { wrapper });

      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
    });

    it('should generate useEntity hook', () => {
      const factory = createQueryFactory<TestEntity>({
        tableName: 'test_entities'
      });
      const wrapper = createWrapper();

      const { result } = renderHook(() => factory.useEntity('test-id'), { wrapper });

      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
    });

    it('should generate useEntitiesInfinite hook', () => {
      const factory = createQueryFactory<TestEntity>({
        tableName: 'test_entities'
      });
      const wrapper = createWrapper();

      const { result } = renderHook(() => factory.useEntitiesInfinite(), { wrapper });

      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('fetchNextPage');
      expect(result.current).toHaveProperty('hasNextPage');
    });

    it('should generate useEntitiesCount hook', () => {
      const factory = createQueryFactory<TestEntity>({
        tableName: 'test_entities'
      });
      const wrapper = createWrapper();

      const { result } = renderHook(() => factory.useEntitiesCount(), { wrapper });

      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('Configuration Options', () => {
    it('should apply default filters', () => {
      const factory = createQueryFactory<TestEntity>({
        tableName: 'test_entities',
        defaultFilters: { where: { active: true } }
      });

      const config = factory.getConfig();
      expect(config.defaultFilters).toEqual({ where: { active: true } });
    });

    it('should set default page size', () => {
      const factory = createQueryFactory<TestEntity>({
        tableName: 'test_entities',
        defaultPageSize: 50
      });

      const config = factory.getConfig();
      expect(config.defaultPageSize).toBe(50);
    });

    it('should enable real-time subscriptions', () => {
      const factory = createQueryFactory<TestEntity>({
        tableName: 'test_entities',
        realTimeSubscription: true
      });

      const config = factory.getConfig();
      expect(config.realTimeSubscription).toBe(true);
    });
  });
});