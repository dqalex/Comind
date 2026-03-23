/**
 * 列表筛选 Hook
 * 
 * 提供统一的列表筛选、搜索、排序功能
 * 替代各页面重复的 useMemo + filter 实现
 */

import { useMemo, useCallback, useState } from 'react';

// ============================================================
// 类型定义
// ============================================================

export interface FilterConfig<T> {
  /** 搜索字段列表 */
  searchFields?: (keyof T)[];
  /** 筛选条件 */
  filters?: Record<string, (item: T) => boolean>;
  /** 默认排序字段 */
  defaultSortField?: keyof T;
  /** 默认排序方向 */
  defaultSortDirection?: 'asc' | 'desc';
  /** 自定义排序函数 */
  sortFn?: (a: T, b: T) => number;
}

export interface UseFilteredListOptions<T> {
  /** 数据源 */
  items: T[];
  /** 配置 */
  config?: FilterConfig<T>;
  /** 额外的筛选条件（外部控制） */
  predicate?: (item: T) => boolean;
}

export interface UseFilteredListReturn<T> {
  /** 筛选后的列表 */
  filteredItems: T[];
  /** 搜索关键词 */
  searchQuery: string;
  /** 设置搜索关键词 */
  setSearchQuery: (query: string) => void;
  /** 当前激活的筛选条件 */
  activeFilters: string[];
  /** 切换筛选条件 */
  toggleFilter: (filterKey: string) => void;
  /** 设置筛选条件 */
  setFilters: (filters: string[]) => void;
  /** 排序字段 */
  sortField: keyof T | null;
  /** 设置排序字段 */
  setSortField: (field: keyof T | null) => void;
  /** 排序方向 */
  sortDirection: 'asc' | 'desc';
  /** 设置排序方向 */
  setSortDirection: (direction: 'asc' | 'desc') => void;
  /** 重置所有筛选 */
  reset: () => void;
  /** 总数 */
  totalCount: number;
  /** 筛选后数量 */
  filteredCount: number;
}

// ============================================================
// Hook 实现
// ============================================================

export function useFilteredList<T extends object>(
  options: UseFilteredListOptions<T>
): UseFilteredListReturn<T> {
  const { items, config = {}, predicate } = options;
  const {
    searchFields = [],
    filters = {},
    defaultSortField,
    defaultSortDirection = 'asc',
    sortFn,
  } = config;

  // 状态
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setFilters] = useState<string[]>([]);
  const [sortField, setSortField] = useState<keyof T | null>(defaultSortField || null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);

  // 搜索过滤
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim() || searchFields.length === 0) {
      return items;
    }

    const query = searchQuery.toLowerCase();
    return items.filter(item =>
      searchFields.some(field => {
        const value = item[field];
        if (value == null) return false;
        return String(value).toLowerCase().includes(query);
      })
    );
  }, [items, searchQuery, searchFields]);

  // 条件过滤
  const conditionFiltered = useMemo(() => {
    if (activeFilters.length === 0) {
      return searchFiltered;
    }

    return searchFiltered.filter(item =>
      activeFilters.every(filterKey => {
        const filterFn = filters[filterKey];
        return filterFn ? filterFn(item) : true;
      })
    );
  }, [searchFiltered, activeFilters, filters]);

  // 外部谓词过滤
  const predicateFiltered = useMemo(() => {
    if (!predicate) {
      return conditionFiltered;
    }

    return conditionFiltered.filter(predicate);
  }, [conditionFiltered, predicate]);

  // 排序
  const filteredItems = useMemo(() => {
    if (!sortField) {
      return predicateFiltered;
    }

    const sorted = [...predicateFiltered].sort((a, b) => {
      if (sortFn) {
        return sortFn(a, b);
      }

      const aVal = a[sortField];
      const bVal = b[sortField];

      // 处理 null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // 字符串比较
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal);
      }

      // 数字比较
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return aVal - bVal;
      }

      // 日期比较
      if (aVal instanceof Date && bVal instanceof Date) {
        return aVal.getTime() - bVal.getTime();
      }

      return 0;
    });

    return sortDirection === 'desc' ? sorted.reverse() : sorted;
  }, [predicateFiltered, sortField, sortDirection, sortFn]);

  // 切换筛选条件
  const toggleFilter = useCallback((filterKey: string) => {
    setFilters(prev => {
      if (prev.includes(filterKey)) {
        return prev.filter(k => k !== filterKey);
      }
      return [...prev, filterKey];
    });
  }, []);

  // 重置
  const reset = useCallback(() => {
    setSearchQuery('');
    setFilters([]);
    setSortField(defaultSortField || null);
    setSortDirection(defaultSortDirection);
  }, [defaultSortField, defaultSortDirection]);

  return {
    filteredItems,
    searchQuery,
    setSearchQuery,
    activeFilters,
    toggleFilter,
    setFilters,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    reset,
    totalCount: items.length,
    filteredCount: filteredItems.length,
  };
}

// ============================================================
// 常用筛选条件工厂
// ============================================================

export const createFilters = {
  /** 状态筛选 */
  status: <T extends { status: string }>(status: string) => 
    (item: T) => item.status === status,

  /** 类型筛选 */
  type: <T extends { type: string }>(type: string) => 
    (item: T) => item.type === type,

  /** 项目筛选 */
  project: <T extends { projectId?: string | null }>(projectId: string | null) => 
    (item: T) => item.projectId === projectId,

  /** 成员筛选 */
  assignee: <T extends { assigneeId?: string | null }>(memberId: string | null) => 
    (item: T) => item.assigneeId === memberId,

  /** 时间范围筛选 */
  dateRange: <T extends Record<string, unknown>>(
    field: keyof T,
    start: Date,
    end: Date
  ) => (item: T) => {
    const value = item[field];
    if (!(value instanceof Date)) return false;
    return value >= start && value <= end;
  },

  /** 非空筛选 */
  notNull: <T extends Record<string, unknown>>(field: keyof T) => 
    (item: T) => item[field] != null,

  /** 布尔筛选 */
  boolean: <T extends Record<string, unknown>>(field: keyof T, value: boolean) => 
    (item: T) => item[field] === value,
};
