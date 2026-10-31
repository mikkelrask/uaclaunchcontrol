import { useTranslate } from '@tolgee/react'
import {
  getAchievementText,
  getAchievementStatLabel,
  formatAchievementStat
} from '@/lib/achievements/messages'
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
 * Extract a numeric value from a stat, handling array-typed stats
 * like `distinctProtocolsLaunched` by using `.length`.
 */
function getStatValue(stats: IPlayerStats, key: string): number {
  const val = (stats as unknown as Record<string, unknown>)[key]
  if (Array.isArray(val)) return val.length
  return (val as number) ?? 0
}

/**
 * Renders a single achievement row with icon, title, description,
 * progress bar(s), and locked/unlocked badge.
 *
 * For compound achievements, shows individual progress bars per condition
 * instead of a single aggregated percentage.
 */
export const AchievementCard: React.FC<AchievementCardProps> = ({ definition, state, stats }) => {
  const { t } = useTranslate('desktop')
  const text = getAchievementText(definition)
  const progressStat = definition.conditions[0]?.stat ?? ''
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
              {t('achievements.card.locked', 'Locked')}
            </Badge>
          </div>
          <p className="text-xs text-app-muted mt-0.5">
            {t('achievements.card.secretHint', 'Secret achievement — keep going')}
          </p>
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
          <span className="text-sm font-medium truncate text-app-primary">{text.title}</span>
          {state.unlocked ? (
            <Badge className="shrink-0 bg-accent-highlight text-white text-[0.625rem] border-0">
              {t('achievements.card.unlocked', 'Unlocked')}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="shrink-0 text-[0.625rem] text-app-muted border-app-muted/30"
            >
              {t('achievements.card.locked', 'Locked')}
            </Badge>
          )}
        </div>
        <p className="text-xs text-app-muted mt-0.5 leading-relaxed">{text.description}</p>

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
                  <span className="text-[0.625rem] text-app-muted font-mono min-w-[90px] shrink-0">
                    {obscure ? '????' : getAchievementStatLabel(condition.stat)}
                  </span>
                  <Progress value={obscure ? 0 : pct} className="h-1.5 bg-app-primary flex-1" />
                  <span className="text-[0.625rem] text-app-muted font-mono shrink-0 w-20 text-right tabular-nums">
                    {obscure
                      ? '?? / ??'
                      : `${formatAchievementStat(condition.stat, currentVal)} / ${formatAchievementStat(condition.stat, condition.min)}`}
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
            <span className="text-[0.625rem] text-app-muted font-mono shrink-0 tabular-nums">
              {state.unlocked
                ? `${formatAchievementStat(progressStat, state.target)} / ${formatAchievementStat(progressStat, state.target)}`
                : `${formatAchievementStat(progressStat, state.progress)} / ${formatAchievementStat(progressStat, state.target)}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default AchievementCard
