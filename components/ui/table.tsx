import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import clsx from 'clsx';

const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-auto">
      <table ref={ref} className={clsx('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
);
Table.displayName = 'Table';

const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={clsx('[&_tr]:border-b', className)} {...props} />
  )
);
TableHeader.displayName = 'TableHeader';

const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={clsx('[&_tr:last-child]:border-0', className)} {...props} />
  )
);
TableBody.displayName = 'TableBody';

const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={clsx(
        'border-b transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
        className
      )}
      style={{ borderColor: 'var(--border)' }}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={clsx('h-10 px-4 text-left align-middle font-semibold text-xs uppercase tracking-wide', className)}
      style={{ color: 'var(--text-tertiary)' }}
      {...props}
    />
  )
);
TableHead.displayName = 'TableHead';

const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={clsx('p-4 align-middle text-sm', className)}
      style={{ color: 'var(--text-primary)' }}
      {...props}
    />
  )
);
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
