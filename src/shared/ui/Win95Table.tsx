import {
  forwardRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react'

type TableProps = {
  children: ReactNode
  /** Minimum table width before horizontal scroll. */
  minWidth?: number
  className?: string
  style?: CSSProperties
}

/**
 * Classic React95-style table (sunken ScrollView chrome + raised header cells).
 * @react95/core does not ship a Table; this mirrors the legacy `react95` Table API.
 * Ref attaches to the scroll container (for TanStack Virtual, etc.).
 */
export const Table = forwardRef<HTMLDivElement, TableProps>(function Table(
  { children, minWidth, className, style },
  ref,
) {
  return (
    <div
      ref={ref}
      className={['r95-table-scroll', className].filter(Boolean).join(' ')}
      style={style}
    >
      <table
        className="r95-table"
        style={minWidth != null ? { minWidth } : undefined}
      >
        {children}
      </table>
    </div>
  )
})


export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="r95-table__head">{children}</thead>
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="r95-table__body">{children}</tbody>
}

export const TableRow = forwardRef<
  HTMLTableRowElement,
  { children: ReactNode } & HTMLAttributes<HTMLTableRowElement>
>(function TableRow({ children, ...rest }, ref) {
  return (
    <tr ref={ref} className="r95-table__row" {...rest}>
      {children}
    </tr>
  )
})


type SortDir = 'asc' | 'desc'

type TableHeadCellProps = {
  children?: ReactNode
  sort?: SortDir | false
  disabled?: boolean
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
} & Omit<ThHTMLAttributes<HTMLTableCellElement>, 'onClick'>

export function TableHeadCell({
  children,
  sort,
  disabled = false,
  onClick,
  style,
  ...rest
}: TableHeadCellProps) {
  const sortable = typeof onClick === 'function' && !disabled
  const ariaSort =
    sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : undefined

  return (
    <th
      className={[
        'r95-table__head-cell',
        sortable ? 'r95-table__head-cell--sortable' : '',
        disabled ? 'r95-table__head-cell--disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-sort={ariaSort}
      aria-disabled={disabled || undefined}
      style={style}
      {...rest}
    >
      {sortable ? (
        <button
          type="button"
          className="r95-table__head-btn"
          disabled={disabled}
          onClick={onClick}
        >
          <span className="r95-table__head-label">{children}</span>
          {sort === 'asc' ? (
            <span className="r95-table__sort" aria-hidden>
              ▲
            </span>
          ) : null}
          {sort === 'desc' ? (
            <span className="r95-table__sort" aria-hidden>
              ▼
            </span>
          ) : null}
        </button>
      ) : (
        <div className="r95-table__head-label">{children}</div>
      )}
    </th>
  )
}

export function TableDataCell({
  children,
  className,
  ...rest
}: { children?: ReactNode; className?: string } & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={['r95-table__cell', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </td>
  )
}

/** @deprecated Prefer `Table` — kept for existing admin pages. */
type Win95TableProps = {
  children: ReactNode
  minWidth?: number
}

export function Win95Table({ children, minWidth }: Win95TableProps) {
  return <Table minWidth={minWidth}>{children}</Table>
}
