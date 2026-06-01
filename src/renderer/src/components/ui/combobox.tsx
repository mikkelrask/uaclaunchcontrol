import * as React from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ComboboxProps {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string; description?: string }[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  className,
  disabled
}: ComboboxProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const listRef = React.useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  const handleWheel = (e: React.WheelEvent): void => {
    if (listRef.current) {
      e.stopPropagation()
      listRef.current.scrollTop += e.deltaY
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between font-normal', className)}
          disabled={disabled}
        >
          {selectedOption
            ? `${selectedOption.label}${selectedOption.description ? ` (${selectedOption.description})` : ''}`
            : placeholder}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-auto h-4 w-4 shrink-0 opacity-50"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList ref={listRef} onWheel={handleWheel}>
            <CommandEmpty>No results found.</CommandEmpty>
            {options.map((opt) => (
              <CommandItem
                key={opt.value}
                value={`${opt.label} ${opt.description || ''}`}
                onSelect={() => {
                  onValueChange(opt.value)
                  setOpen(false)
                }}
              >
                <span>{opt.label}</span>
                {opt.description && (
                  <span className="ml-1 text-xs text-muted-foreground opacity-60">
                    ({opt.description})
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
