import { useState, useMemo, useEffect, memo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
} from '@tanstack/react-table'
import type { ColumnDef, SortingState, ExpandedState, Row } from '@tanstack/react-table'
import { Skeleton } from '#/components/ui/skeleton'
import { TruncatedCell } from '#/components/ui/truncated-cell'
import { getStatusClasses } from '#/lib/resource-helpers'
import { useSettings } from '#/hooks/use-settings'

type KubeItem = Record<string, unknown>

type GroupAggregate = {
  label: string
  statusCounts: Record<string, number>
  totalRestarts: number
}

type ResourceTableProps = {
  data: KubeItem[]
  columns: ColumnDef<KubeItem>[]
  isLoading: boolean
  onRowClick?: (item: KubeItem) => void
  groupByColumn?: string
  getGroupAggregate?: (rows: Row<KubeItem>[]) => GroupAggregate
  onExpandedChange?: (hasExpanded: boolean) => void
  renderRowAction?: (item: KubeItem) => React.ReactNode
}

function TableSkeleton({ columnCount }: { columnCount: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 dark:bg-surface-highlight/50">
          <tr>
            {Array.from({ length: columnCount }).map((_, i) => (
              <th key={i} className="px-6 py-4">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light dark:divide-border-dark">
          {Array.from({ length: 8 }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: columnCount }).map((_, colIdx) => (
                <td key={colIdx} className="px-6 py-4">
                  <Skeleton className="h-4 w-full max-w-[160px]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ value }: { value: string }) {
  const classes = getStatusClasses(value)

  return (
    <div className="flex items-center gap-2">
      <div className={`h-2.5 w-2.5 rounded-full ${classes.dot}`} />
      <span className="font-medium text-slate-900 dark:text-white">{value}</span>
    </div>
  )
}

function SortIcon({ direction }: { direction: 'asc' | 'desc' | false }) {
  if (!direction) {
    return (
      <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-50 transition-opacity">
        arrow_upward
      </span>
    )
  }

  return (
    <span className="material-symbols-outlined text-[14px] text-primary">
      {direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
    </span>
  )
}

function GroupHeaderRow({
  row,
  colSpan,
  aggregate,
}: {
  row: Row<KubeItem>
  colSpan: number
  aggregate?: GroupAggregate
}) {
  const count = row.subRows.length

  return (
    <tr
      className="bg-slate-50/50 dark:bg-surface-highlight/20 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-surface-hover/40 transition-colors"
      onClick={() => row.toggleExpanded()}
    >
      <td colSpan={colSpan} className="px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[18px] text-slate-400 transition-transform duration-150" style={{ transform: row.getIsExpanded() ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            chevron_right
          </span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {row.groupingValue as string}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-slate-300">
            {count} {count === 1 ? 'pod' : 'pods'}
          </span>
          {aggregate && (
            <div className="flex items-center gap-3 ml-2 text-xs text-slate-500 dark:text-slate-400">
              {Object.entries(aggregate.statusCounts).map(([status, cnt]) => {
                const classes = getStatusClasses(status)
                return (
                  <span key={status} className="flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${classes.dot}`} />
                    {cnt} {status}
                  </span>
                )
              })}
              {aggregate.totalRestarts > 0 && (
                <span className="text-amber-500">
                  {aggregate.totalRestarts} restarts
                </span>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export const ResourceTable = memo(function ResourceTable({ data, columns, isLoading, onRowClick, groupByColumn, getGroupAggregate, onExpandedChange, renderRowAction }: ResourceTableProps) {
  const { settings } = useSettings()
  const cp = settings.compactMode
  const cellCls = cp ? 'px-4 py-2' : 'px-6 py-4'
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const visibleColumns = useMemo(() => {
    if (!groupByColumn) return columns
    return columns.filter((col) => 'id' in col && col.id !== groupByColumn)
  }, [columns, groupByColumn])

  const grouping = useMemo(
    () => (groupByColumn ? [groupByColumn] : []),
    [groupByColumn],
  )
  const columnVisibility = useMemo(
    () => (groupByColumn ? { [groupByColumn]: false } : {}),
    [groupByColumn],
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      expanded,
      grouping,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    autoResetExpanded: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    initialState: {
      pagination: {
        pageSize: settings.pageSize,
      },
    },
  })

  useEffect(() => {
    table.setPageSize(settings.pageSize)
  }, [settings.pageSize, table])

  useEffect(() => {
    if (!onExpandedChange) return
    const hasExpanded = expanded === true || (typeof expanded === 'object' && Object.values(expanded).some(Boolean))
    onExpandedChange(hasExpanded)
  }, [expanded, onExpandedChange])

  if (isLoading) {
    return (
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border-light dark:border-border-dark">
          <Skeleton className="h-8 w-64" />
        </div>
        <TableSkeleton columnCount={visibleColumns.length} />
      </div>
    )
  }

  const pageCount = table.getPageCount()
  const currentPage = table.getState().pagination.pageIndex
  const totalRows = table.getFilteredRowModel().rows.length
  const pageSize = table.getState().pagination.pageSize
  const startRow = currentPage * pageSize + 1
  const endRow = Math.min((currentPage + 1) * pageSize, totalRows)

  const visibleColumnCount = table.getVisibleLeafColumns().length

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border-light dark:border-border-dark flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[18px]">
              filter_list
            </span>
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-background-dark border border-border-light dark:border-border-dark rounded-md text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
              placeholder="Filter resources..."
            />
          </div>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {totalRows} {totalRows === 1 ? 'item' : 'items'}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
          <thead className="bg-slate-50 dark:bg-surface-highlight/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  if (!header.column.getIsVisible()) return null
                  const canSort = header.column.getCanSort()
                  return (
                    <th
                      key={header.id}
                      className={`${cellCls} ${canSort ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 group select-none' : ''}`}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <div className="flex items-center gap-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && <SortIcon direction={header.column.getIsSorted()} />}
                      </div>
                    </th>
                  )
                })}
                {renderRowAction && <th className={`${cellCls} w-10`} />}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnCount} className="px-6 py-12 text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-500 dark:text-slate-600 mb-2 block">
                    inbox
                  </span>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">No resources found</p>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                if (row.getIsGrouped()) {
                  const aggregate = getGroupAggregate?.(row.subRows)
                  return (
                    <GroupHeaderRow
                      key={row.id}
                      row={row}
                      colSpan={visibleColumnCount}
                      aggregate={aggregate}
                    />
                  )
                }

                const isSubRow = row.depth > 0

                return (
                  <tr
                    key={row.id}
                    className={`group hover:bg-slate-50 dark:hover:bg-surface-hover/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => {
                      if (cell.getIsGrouped() || cell.getIsPlaceholder()) return null

                      const isStatus = (cell.column.columnDef.meta as { isStatus?: boolean })?.isStatus
                      const isName = cell.column.id === 'name'
                      const isAge = cell.column.id === 'age'

                      return (
                        <td key={cell.id} className={`${cellCls} ${isSubRow && isName ? 'pl-12' : ''} max-w-[300px]`}>
                          {isStatus ? (
                            <StatusBadge value={cell.getValue() as string} />
                          ) : isName ? (
                            <TruncatedCell className="font-medium text-primary hover:text-primary/80">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TruncatedCell>
                          ) : isAge ? (
                            <span className="font-mono text-sm">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </span>
                          ) : (
                            <TruncatedCell>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TruncatedCell>
                          )}
                        </td>
                      )
                    })}
                    {renderRowAction && (
                      <td className={cellCls} onClick={(e) => e.stopPropagation()}>
                        {renderRowAction(row.original)}
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="border-t border-border-light dark:border-border-dark px-4 py-3 flex items-center justify-between sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700 dark:text-slate-400">
              Showing <span className="font-medium text-slate-900 dark:text-white">{startRow}</span>{' '}
              to <span className="font-medium text-slate-900 dark:text-white">{endRow}</span> of{' '}
              <span className="font-medium text-slate-900 dark:text-white">{totalRows}</span> results
            </p>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark text-sm font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              {getPaginationRange(currentPage, pageCount).map((page, idx) =>
                page === 'ellipsis' ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="relative inline-flex items-center px-4 py-2 border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark text-sm font-medium text-slate-700 dark:text-slate-400"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => table.setPageIndex(page)}
                    className={
                      page === currentPage
                        ? 'z-10 bg-primary/10 border-primary text-primary relative inline-flex items-center px-4 py-2 border text-sm font-medium'
                        : 'bg-white dark:bg-surface-dark border-border-light dark:border-border-dark text-slate-500 hover:bg-slate-50 dark:hover:bg-surface-hover relative inline-flex items-center px-4 py-2 border text-sm font-medium'
                    }
                  >
                    {page + 1}
                  </button>
                ),
              )}
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark text-sm font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  )
})

function getPaginationRange(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i)
  }

  const pages: (number | 'ellipsis')[] = []

  pages.push(0)

  if (current > 2) {
    pages.push('ellipsis')
  }

  const start = Math.max(1, current - 1)
  const end = Math.min(total - 2, current + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < total - 3) {
    pages.push('ellipsis')
  }

  pages.push(total - 1)

  return pages
}
