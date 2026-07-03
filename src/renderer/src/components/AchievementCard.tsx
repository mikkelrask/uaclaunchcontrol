import React from 'react'
import type { IAchievementDefinition } from '@/lib/achievements'
import type { IAchievementState, IPlayerStats } from '@shared/schema'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { getProgressPercentage } from '@/lib/achievements'
import { type LucideIcon, HelpCircle, CheckCircle2 } from 'lucide-react'
import * as LucideIcons from 'lucide-react'

interface AchievementCardProps {
  definition: IAchievementDefinition
  state: IAchievementState
  /** Current player stats for computing per-condition progress on compound achievements */
  stats?: IPlayerStats
}

/**
 * Human-readable labels for each stat key shown in compound achievement conditions.
 */
const STAT_LABELS: Record<string, string> = {
  totalProtocolsCreated: 'Protocols Created',
  totalProtocolsLaunched: 'Protocols Launched',
  totalModFilesAdded: 'Mod Files Added',
  totalWadsImported: 'WADs Imported',
  totalPlaytimeSeconds: 'Playtime',
  totalCatalogFilesManaged: 'Files Cataloged',
  protocolsLaunchedThisSession: 'This Session',
  distinctProtocolsLaunched: 'Unique Protocols',
  maxModFilesInSingleProtocol: 'Max Files/Protocol',
  reachedIconOfSin: `Romero's head on a stick`
}

/**
 * Extract a numeric value from a stat, handling array-typed stats
 * like `distinctProtocolsLaunched` by using `.length`.
 */
function getStatValue(stats: IPlayerStats, key: string): number {
  const val = (stats as unknown as Record<string, unknown>)[key]
  if (Array.isArray(val)) return val.length
  return (val as number) ?? 0
}

/**
 * Format a stat value for display — special handling for playtime seconds
 * (shows only hours, no minutes).
 */
function formatStatValue(key: string, value: number): string {
  if (key === 'totalPlaytimeSeconds') {
    const hours = Math.floor(value / 3600)
    return `${hours}h`
  }
  return String(Math.floor(value))
}

/**
 * Format a value for the single progress bar display, using the
 * achievement's first condition to determine the stat type.
 */
function formatDisplayProgress(def: IAchievementDefinition, value: number): string {
  const statKey = def.conditions[0]?.stat
  if (statKey === 'totalPlaytimeSeconds') {
    const hours = Math.floor(value / 3600)
    return `${hours}h`
  }
  return String(Math.floor(value))
}

/**
 * Format a threshold value for display.
 */
function formatThreshold(key: string, value: number): string {
  if (key === 'totalPlaytimeSeconds') {
    const hours = Math.floor(value / 3600)
    return `${hours}h`
  }
  return String(value)
}

/**
 * Renders a single achievement row with icon, title, description,
 * progress bar(s), and locked/unlocked badge.
 *
 * For compound achievements, shows individual progress bars per condition
 * instead of a single aggregated percentage.
 */
export const AchievementCard: React.FC<AchievementCardProps> = ({ definition, state, stats }) => {
  // Dynamically resolve the Lucide icon by name
  const IconComponent =
    (LucideIcons as unknown as Record<string, LucideIcon>)[definition.icon] ?? HelpCircle

  const progressPct = getProgressPercentage(state)

  // For event-qualifier achievements, only show locked/unlocked without a progress bar
  const showProgress = definition.type !== 'event-qualifier' && state.target > 1

  // If the achievement is hidden and locked, show a placeholder
  if (definition.hidden && !state.unlocked) {
    return (
      <div className="flex items-start gap-3 p-2 rounded-md opacity-50">
        <div className="p-2 rounded-md bg-app-primary">
          <HelpCircle className="w-5 h-5 text-app-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-app-muted">???</span>
            <Badge variant="outline" className="shrink-0 text-xs">
              Locked
            </Badge>
          </div>
          <p className="text-xs text-app-muted mt-0.5">Secret achievement — keep going</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 p-2 rounded-md hover:bg-app-hover transition-colors">
      <div className="p-2 rounded-md bg-app-primary shrink-0">
        <IconComponent
          className={`w-5 h-5 ${state.unlocked ? 'text-accent-highlight' : 'text-app-muted'}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate text-app-primary">{definition.title}</span>
          {state.unlocked ? (
            <Badge className="shrink-0 bg-accent-highlight text-white text-[10px] border-0">
              Unlocked
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="shrink-0 text-[10px] text-app-muted border-app-muted/30"
            >
              Locked
            </Badge>
          )}
        </div>
        <p className="text-xs text-app-muted mt-0.5 leading-relaxed">{definition.description}</p>

        {/* Per-condition progress for compound achievements */}
        {definition.type === 'compound' && stats && !state.unlocked && (
          <div className="mt-2 space-y-1.5">
            {definition.conditions.map((condition, i) => {
              const currentVal = getStatValue(stats, condition.stat)
              const met = currentVal >= condition.min
              const pct = Math.min(100, Math.round((currentVal / condition.min) * 100))
              const obscure = condition.secret && !met
              return (
                <div key={i} className="flex items-center gap-2">
                  {met ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="text-[10px] text-app-muted font-mono min-w-[90px] shrink-0">
                    {obscure ? '????' : (STAT_LABELS[condition.stat] ?? condition.stat)}
                  </span>
                  <Progress value={obscure ? 0 : pct} className="h-1.5 bg-app-primary flex-1" />
                  <span className="text-[10px] text-app-muted font-mono shrink-0 w-20 text-right tabular-nums">
                    {obscure
                      ? '?? / ??'
                      : `${formatStatValue(condition.stat, currentVal)} / ${formatThreshold(condition.stat, condition.min)}`}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Single progress bar for non-compound achievements */}
        {showProgress && definition.type !== 'compound' && (
          <div className="flex items-center gap-2 mt-2">
            <Progress value={progressPct} className="h-1.5 bg-app-primary" />
            <span className="text-[10px] text-app-muted font-mono shrink-0 tabular-nums">
              {state.unlocked
                ? `${formatDisplayProgress(definition, state.target)} / ${formatDisplayProgress(definition, state.target)}`
                : `${formatDisplayProgress(definition, state.progress)} / ${formatDisplayProgress(definition, state.target)}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default AchievementCard
