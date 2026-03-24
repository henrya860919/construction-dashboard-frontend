import type { Component } from 'vue'

/** 列表頁資料表工具列三區開關（搜尋／篩選與排序／欄位顯示） */
export interface TableListFeatures {
  search: boolean
  filtersAndSort: boolean
  columnVisibility: boolean
}

/** 分面篩選選項（對齊 DataTableFacetedFilter） */
export interface DataTableFacetedFilterOption {
  label: string
  value: string
  icon?: Component
}

/** 欄位 meta：工具列依 type 自動掛載篩選 UI */
export type DataTableColumnFilterMeta =
  | {
      type: 'faceted'
      title: string
      options: DataTableFacetedFilterOption[]
    }
  | {
      type: 'dateRange'
      title: string
    }

declare module '@tanstack/vue-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** 欄位顯示名（欄位顯示／多欄排序）；未設則 fallback 欄位 id */
    label?: string
    /** 全文搜尋是否涵蓋此欄（由頁面提供 globalFilterFn 實作對應欄位） */
    searchable?: boolean
    /** 篩選＋排序開啟時，工具列依此自動掛載分面或日期篩選 */
    filter?: DataTableColumnFilterMeta
  }
}
