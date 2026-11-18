"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowDownUp, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { SelectField, TextField } from "@/components/ui/field";
import { DATA_TABLE_DEFAULT_PAGE_SIZE, DATA_TABLE_FIELD_PREFIXES, DATA_TABLE_PAGE_SIZES } from "@/lib/constants";

export type DataTableColumn<Row> = {
  id: string;
  label: string;
  sortValue: (row: Row) => string | number;
  render: (row: Row) => ReactNode;
};

type SortState = { columnId: string; direction: "ascending" | "descending" };
type CompactTableOptions = {
  summaryColumnId: string;
  detailColumnIds: readonly string[];
  actionsColumnId?: string;
};

type DataTableProps<Row> = {
  id: string;
  rows: readonly Row[];
  columns: readonly DataTableColumn<Row>[];
  getRowId: (row: Row) => string;
  searchLabel: string;
  pageSizeLabel: string;
  emptyMessage: string;
  noMatchesMessage: string;
  searchValue: (row: Row) => string;
  locale: string;
  initialSortColumnId: string;
  compact?: CompactTableOptions;
};

export function DataTable<Row>({
  id,
  rows,
  columns,
  getRowId,
  searchLabel,
  pageSizeLabel,
  emptyMessage,
  noMatchesMessage,
  searchValue,
  locale,
  initialSortColumnId,
  compact,
}: DataTableProps<Row>) {
  const t = useTranslations("dataTable");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortState>({ columnId: initialSortColumnId, direction: "ascending" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DATA_TABLE_DEFAULT_PAGE_SIZE);

  const filteredRows = useMemo(() => {
    const normalizedFilter = filter.trim().toLocaleLowerCase(locale);
    if (!normalizedFilter) return rows;
    return rows.filter((row) => searchValue(row).toLocaleLowerCase(locale).includes(normalizedFilter));
  }, [filter, locale, rows, searchValue]);

  const sortedRows = useMemo(() => {
    const activeColumn = columns.find((column) => column.id === sort.columnId) ?? columns[0];
    if (!activeColumn) return filteredRows;

    return filteredRows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const leftValue = activeColumn.sortValue(left.row);
        const rightValue = activeColumn.sortValue(right.row);
        const result = typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), locale, { numeric: true, sensitivity: "base" });
        const direction = sort.direction === "ascending" ? 1 : -1;
        return result === 0 ? left.index - right.index : result * direction;
      })
      .map(({ row }) => row);
  }, [columns, filteredRows, locale, sort.columnId, sort.direction]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function changeSort(columnId: string) {
    setSort((current) => ({
      columnId,
      direction: current.columnId === columnId && current.direction === "ascending" ? "descending" : "ascending",
    }));
  }

  function changeSortDirection() {
    setSort((current) => ({ ...current, direction: current.direction === "ascending" ? "descending" : "ascending" }));
  }

  return (
    <div className={compact ? "dataTable dataTable--compact" : "dataTable"}>
      <div className="dataTable__toolbar">
        <TextField
          id={`${DATA_TABLE_FIELD_PREFIXES.filter}${id}`}
          label={searchLabel}
          type="search"
          value={filter}
          onChange={(event) => { setFilter(event.target.value); setPage(1); }}
        />
        <SelectField
          id={`${DATA_TABLE_FIELD_PREFIXES.pageSize}${id}`}
          label={pageSizeLabel}
          value={pageSize}
          onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
        >
          {DATA_TABLE_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
        </SelectField>
      </div>
      <p className="dataTable__resultCount" aria-live="polite">{t("resultCount", { count: filteredRows.length })}</p>
      {compact ? <>
        <div className="dataTable__compactSort">
          <SelectField id={`${id}-compact-sort`} label={t("sortColumn")} value={sort.columnId} onChange={(event) => { setSort((current) => ({ ...current, columnId: event.target.value })); setPage(1); }}>
            {columns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}
          </SelectField>
          <Button appearance="quiet" type="button" aria-label={t(sort.direction === "ascending" ? "sortAscending" : "sortDescending", { column: columns.find((column) => column.id === sort.columnId)?.label ?? "" })} onClick={changeSortDirection}>
            {sort.direction === "ascending" ? <ArrowUp aria-hidden="true" size={16} /> : <ArrowDown aria-hidden="true" size={16} />}
          </Button>
        </div>
        <ul className="dataTable__compactList">
          {pageRows.map((row) => {
            const summaryColumn = columns.find((column) => column.id === compact.summaryColumnId);
            const actionsColumn = compact.actionsColumnId ? columns.find((column) => column.id === compact.actionsColumnId) : undefined;
            const detailColumns = compact.detailColumnIds.flatMap((columnId) => {
              const column = columns.find((candidate) => candidate.id === columnId);
              return column ? [{ column, value: column.render(row) }] : [];
            });
            return <li key={getRowId(row)}>
              <article className="dataTable__compactCard">
                <header className="dataTable__compactHeader"><div>{summaryColumn?.render(row)}</div>{actionsColumn ? <div className="dataTable__compactActions">{actionsColumn.render(row)}</div> : null}</header>
                <Disclosure title={t("compactDetails")} className="dataTable__compactDetails">
                  <dl>{detailColumns.map(({ column, value }) => <div key={column.id}><dt>{column.label}</dt><dd>{value}</dd></div>)}</dl>
                </Disclosure>
              </article>
            </li>;
          })}
          {pageRows.length === 0 ? <li className="dataTable__compactEmpty">{rows.length === 0 ? emptyMessage : noMatchesMessage}</li> : null}
        </ul>
      </> : null}
      <div className="dataTable__scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  aria-sort={sort.columnId === column.id ? sort.direction : "none"}
                  key={column.id}
                  scope="col"
                >
                  <button
                    className="dataTable__sortButton"
                    type="button"
                    aria-label={t(sort.columnId === column.id ? sort.direction === "ascending" ? "sortAscending" : "sortDescending" : "sortBy", { column: column.label })}
                    onClick={() => changeSort(column.id)}
                  >
                    <span>{column.label}</span>
                    {sort.columnId === column.id
                      ? sort.direction === "ascending" ? <ArrowUp aria-hidden="true" size={15} /> : <ArrowDown aria-hidden="true" size={15} />
                      : <ArrowDownUp aria-hidden="true" size={15} />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={getRowId(row)}>
                {columns.map((column) => <td key={column.id}>{column.render(row)}</td>)}
              </tr>
            ))}
            {pageRows.length === 0 ? (
              <tr><td className="dataTable__empty" colSpan={columns.length}>{rows.length === 0 ? emptyMessage : noMatchesMessage}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <nav className="dataTable__pagination" aria-label={t("pagination") }>
        <Button appearance="quiet" type="button" aria-label={t("previousPage")} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
          <ChevronLeft aria-hidden="true" size={18} />
          {t("previousPage")}
        </Button>
        <span aria-live="polite">{t("pagePosition", { page: currentPage, pageCount })}</span>
        <Button appearance="quiet" type="button" aria-label={t("nextPage")} disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>
          {t("nextPage")}
          <ChevronRight aria-hidden="true" size={18} />
        </Button>
      </nav>
    </div>
  );
}
