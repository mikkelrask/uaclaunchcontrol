import { ColumnDef } from '@tanstack/react-table'
import { IModFile } from '@shared/schema'
import { Button } from '@/components/ui/button'
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Pencil, Trash2 } from 'lucide-react'

export interface CatalogColumnCallbacks {
  catalogFiles: IModFile[]
  onEdit: (file: IModFile) => void
  onDelete: (file: IModFile) => void
  onOpenUrl: (url: string) => void
}

export function getCatalogColumns(callbacks: CatalogColumnCallbacks): ColumnDef<IModFile>[] {
  const { catalogFiles, onEdit, onDelete, onOpenUrl } = callbacks

  function SortableHeader({
    column,
    title
  }: {
    column: {
      getIsSorted: () => false | 'asc' | 'desc'
      toggleSorting: (desc?: boolean) => void
    }
    title: string
  }): React.ReactElement {
    const sorted = column.getIsSorted()
    return (
      <button
        type="button"
        className="flex items-center gap-1 hover:text-app-primary transition-colors -ml-1 px-1"
        onClick={() => column.toggleSorting(sorted === 'asc')}
      >
        {title}
        {sorted === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : sorted === 'desc' ? (
          <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    )
  }

  return [
    {
      accessorKey: 'name',
      header: ({ column }) => <SortableHeader column={column} title="Name" />,
      cell: ({ row }) => {
        const file = row.original
        return (
          <div className="flex items-center gap-2">
            <span>{file.name || file.fileName}</span>
            {file.sidecarOnly && (
              <span className="px-1.5 py-0.5 bg-yellow-900/50 text-yellow-500 text-xs rounded">
                sidecar
              </span>
            )}
          </div>
        )
      },
      filterFn: (row, _columnId, filterValue: string) => {
        const name = (row.original.name || row.original.fileName || '').toLowerCase()
        return name.includes(filterValue.toLowerCase())
      }
    },
    {
      accessorKey: 'version',
      header: ({ column }) => <SortableHeader column={column} title="Version" />,
      cell: ({ row }) => <span className="text-app-muted">{row.original.version || '–'}</span>,
      size: 100
    },
    {
      accessorKey: 'fileType',
      header: ({ column }) => <SortableHeader column={column} title="Type" />,
      cell: ({ row }) => (
        <span className="px-2 py-1 bg-app-primary rounded text-xs">{row.original.fileType}</span>
      ),
      filterFn: (row, _columnId, filterValue: string) => {
        if (!filterValue || filterValue === 'all') return true
        return row.original.fileType === filterValue
      },
      size: 20
    },
    {
      id: 'dependencies',
      header: 'Load Order',
      cell: ({ row }) => {
        const file = row.original
        if (!file.loadOrder || Object.keys(file.loadOrder).length === 0) {
          return <span className="text-app-muted">–</span>
        }
        const names = Object.keys(file.loadOrder)
          .map((hash) => catalogFiles.find((f) => f.hashValue === hash)?.name)
          .filter(Boolean)
        const fullString = names.length > 0 ? names.join(', ') : '–'
        const displayString = fullString.length > 70 ? fullString.slice(0, 60) + '…' : fullString
        return (
          <span
            className="text-app-muted text-xs cursor-help"
            title={fullString !== '–' ? fullString : undefined}
          >
            {displayString}
          </span>
        )
      },
      enableSorting: false,
      size: 480
    },
    {
      accessorKey: 'hashValue',
      header: 'MD5 Checksum',
      cell: ({ row }) => {
        const hash = row.original.hashValue
        if (!hash) return <span className="text-app-muted">–</span>
        return (
          <span className="text-app-muted font-mono" title={hash}>
            {hash.slice(0, 36)}
          </span>
        )
      },
      enableSorting: true,
      size: 140
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const file = row.original
        return (
          <div className="flex items-center gap-1 justify-end">
            {file.url && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenUrl(file.url!)}
                className="text-app-muted hover:text-app-primary p-1 h-8 w-8"
                title="Open URL"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(file)}
              className="text-app-muted hover:text-app-primary p-1 h-8 w-8"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(file)}
              className="text-red-500 hover:text-red-700 hover:bg-transparent p-1 h-8 w-8"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      },
      enableSorting: false,
      enableHiding: false,
      size: 120
    }
  ]
}
