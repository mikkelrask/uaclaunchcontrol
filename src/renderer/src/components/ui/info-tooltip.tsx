import React from 'react'
import { HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface InfoTooltipProps {
  text: string
  className?: string
}

/** Small (?) icon that reveals a short explanation on hover — for a label or toggle that isn't self-explanatory. */
export function InfoTooltip({ text, className }: InfoTooltipProps): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className={cn('h-3.5 w-3.5 text-app-muted cursor-help shrink-0', className)} />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
    </Tooltip>
  )
}

export default InfoTooltip
