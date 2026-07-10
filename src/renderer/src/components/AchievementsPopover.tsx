import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import type { IPlayerData, IPlayerStats } from '@shared/schema'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Anvil } from 'lucide-react'
import AchievementCard from './AchievementCard'
import { ACHIEVEMENT_REGISTRY, getAchievementsByCategory } from '@/lib/achievements'
import { getRankTitle } from '@/lib/advancement'
import marine from '@/assets/marine.webp'
import sergeant from '@/assets/sergeant.webp'
import doomSlayer from '@/assets/DoomSlayer.webp'

const RANK_IMAGES: Record<string, string> = {
  marine,
  sergeant,
  slayer: doomSlayer
}

const rankImage = (rank?: string): string => RANK_IMAGES[rank ?? ''] ?? marine

interface AchievementsPopoverProps {
  /** The child element that triggers the popover (e.g. profile badge) */
  children: React.ReactNode
}

/**
 * Popover showing the operator profile, current rank, and all achievements
 * grouped by category with progress bars.
 */
export const AchievementsPopover: React.FC<AchievementsPopoverProps> = ({ children }) => {
  const [open, setOpen] = useState(false)

  // Fetch player data for achievement states + rank
  const { data: playerData } = useQuery<IPlayerData>({
    queryKey: ['/api/player-data'],
    queryFn: api.getPlayerData,
    enabled: open, // Only fetch when popover is open
    staleTime: 30_000 // Re-fetch at most every 30s
  })

  // Compute categories from the registry
  const categories = Array.from(new Set(ACHIEVEMENT_REGISTRY.map((a) => a.category)))

  // Total unlocked count for the header
  const unlockedCount = playerData
    ? Object.values(playerData.achievements).filter((s) => s.unlocked).length
    : 0

  // Count of recently unlocked (last 3)
  const recentUnlocks = playerData
    ? Object.entries(playerData.achievements)
        .filter(([, state]) => state.unlocked && state.unlockedAt)
        .sort(
          ([, a], [, b]) =>
            new Date(b.unlockedAt || 0).getTime() - new Date(a.unlockedAt || 0).getTime()
        )
        .slice(0, 3)
    : []

  const totalAchievements = ACHIEVEMENT_REGISTRY.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[520px] p-0 overflow-hidden bg-app-primary shadow-2xl border-app"
        align="end"
        sideOffset={8}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between p-4 border-b border-app bg-app-secondary">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-highlight/10 rounded-md">
              <Anvil className="w-5 h-5 text-accent-highlight" />
            </div>
            <div>
              <h4 className="text-lg font-bold tracking-tight text-app-primary lowercase">
                Operator Profile
              </h4>
              <p className="text-[0.625rem] font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                UAC Launch Control // Personnel File
              </p>
            </div>
          </div>

          {/* Rank badge */}
          <Badge
            variant="outline"
            className="border-accent-highlight/50 text-accent-highlight text-[0.625rem] tracking-widest uppercase font-bold px-2 py-1"
          >
            {getRankTitle(playerData?.rank)}
          </Badge>
        </div>

        {/* ── Profile Preview ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-app/50 bg-app-secondary/30">
          <div className="w-10 h-10 rounded bg-accent-highlight flex items-center justify-center text-white shrink-0 overflow-hidden">
            <img src={rankImage(playerData?.rank)} alt="Operator" className="w-10 h-10 rounded" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-app-primary">Guy, Doom</div>
            <div className="text-xs text-app-muted">
              {unlockedCount}/{totalAchievements} achievements unlocked
            </div>
          </div>
        </div>

        {/* ── Recently Unlocked ── */}
        {recentUnlocks.length > 0 && (
          <div className="px-4 pt-3 pb-1 border-b border-app/30">
            <h5 className="text-[0.625rem] font-bold text-app-muted uppercase tracking-widest mb-1">
              Recently Unlocked
            </h5>
            <div className="flex flex-wrap gap-2">
              {recentUnlocks.map(([id]) => {
                const def = ACHIEVEMENT_REGISTRY.find((a) => a.id === id)
                if (!def) return null
                return (
                  <Badge
                    key={id}
                    className="bg-accent-highlight/15 text-accent-highlight border border-accent-highlight/30 text-[0.625rem]"
                  >
                    {def.title}
                  </Badge>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Achievement Tabs ── */}
        <Tabs defaultValue="progression" className="w-full">
          <div className="px-3 pt-2 border-b border-app/30">
            <TabsList className="bg-app-primary border border-app/50 w-full">
              {categories.map((cat) => (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className="flex-1 text-[0.625rem] uppercase tracking-wider data-[state=active]:bg-accent-highlight data-[state=active]:text-white"
                >
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {categories.map((cat) => {
            const catAchievements = getAchievementsByCategory(cat)
            return (
              <TabsContent key={cat} value={cat} className="m-0">
                <ScrollArea className="h-[320px]">
                  <div className="p-3 space-y-1">
                    {catAchievements.map((def) => {
                      const liveStats = playerData?.stats
                      let state = playerData?.achievements[def.id]

                      // Helper to safely get a numeric value from a stat (handles arrays)
                      const getNumStat = (s: IPlayerStats, k: string): number => {
                        const v = (s as unknown as Record<string, unknown>)[k]
                        if (Array.isArray(v)) return v.length
                        return (v as number) ?? 0
                      }

                      if (!state) {
                        // Build a live-computed state for achievements not yet tracked
                        let progress = 0
                        let target = 1

                        if (def.type === 'event-qualifier') {
                          target = 1
                        } else if (def.type === 'compound') {
                          target = 100 // percentage-based
                          if (liveStats) {
                            const met = def.conditions.filter(
                              (c) => getNumStat(liveStats, c.stat) >= c.min
                            ).length
                            progress = Math.round((met / def.conditions.length) * 100)
                          }
                        } else if (def.type === 'incremental' || def.type === 'threshold') {
                          const condition = def.conditions[0]
                          if (condition) {
                            target = condition.min
                            if (liveStats) {
                              progress = Math.min(
                                getNumStat(liveStats, condition.stat),
                                condition.min
                              )
                            }
                          }
                        }

                        state = {
                          unlocked: progress >= target,
                          progress,
                          target
                        }
                      }

                      return (
                        <AchievementCard
                          key={def.id}
                          definition={def}
                          state={state}
                          stats={liveStats}
                        />
                      )
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            )
          })}
        </Tabs>

        {/* ── Footer Stats ── */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-app bg-app-secondary/50">
          <span className="text-[0.625rem] font-mono text-app-muted uppercase tracking-wider">
            Total Protocol Count: {playerData?.stats?.totalProtocolsCreated ?? 0}
          </span>
          <span className="text-[0.625rem] font-mono text-app-muted uppercase tracking-wider">
            Total Playtime:{' '}
            {(playerData?.stats?.totalPlaytimeSeconds ?? 0) >= 3600
              ? `${Math.floor((playerData?.stats?.totalPlaytimeSeconds ?? 0) / 3600)}h`
              : `${Math.floor((playerData?.stats?.totalPlaytimeSeconds ?? 0) / 60)}m`}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default AchievementsPopover
