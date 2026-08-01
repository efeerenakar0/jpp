import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  caption?: string;
}

export default function DataTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
}: DataTableProps<T>) {
  return (
    <div className="ceo-data-table overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <Table>
        {caption && <caption className="sr-only">{caption}</caption>}
        <TableHeader>
          <TableRow className="border-slate-800 hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column.key} className={`h-11 text-xs font-semibold text-slate-400 ${column.className ?? ''}`}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={getRowKey(row)} className="border-slate-800 hover:bg-slate-800/50">
              {columns.map((column) => (
                <TableCell key={column.key} className={column.className}>
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
