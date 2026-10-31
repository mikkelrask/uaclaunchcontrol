import React from 'react'
import { useTranslate } from '@tolgee/react'
import doom from './doom.png'
import doom2 from './doom2.png'
import freedoom from './freedoom1.png'
import freedoom2 from './freedoom2.png'
import freedm from './freedm.png'
import plutonia from './plutonia.png'
import tnt from './tnt.png'
import hexen from './hexen.png'
import hexdd from './hexdd.png'
import heretic from './heretic.png'
import strife from './strife1.png'
import chex from './chex.png'
import chex2 from './chex2.png'
import chex3 from './chex3.png'
import defaultIcon from './default.png'
import { toFileUrl } from '@/lib/utils'

interface DoomIconProps {
  className?: string
}

/** Game titles stay canonical; only the accessible icon description is translated. */
const GameIcon = ({
  src,
  game,
  title,
  className
}: DoomIconProps & {
  src: string
  game?: string
  title?: string
}): React.ReactElement => {
  const { t } = useTranslate('desktop')
  return (
    <img
      src={src}
      alt={
        game ? t('icons.game', '{game} Icon', { game }) : t('icons.defaultWad', 'Default WAD Icon')
      }
      title={title ?? t('icons.launcher', 'Doom Launcher')}
      className={`${className} object-contain aspect-square`}
    />
  )
}

export const DoomIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <GameIcon src={doom} game="Doom" title="DOOM" className={className} />
)

export const Doom2Icon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <GameIcon src={doom2} game="Doom 2" title="DOOM II" className={className} />
)

export const FreeDoomIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <GameIcon src={freedoom} game="FreeDoom" title="FREEDOOM: PHASE 1" className={className} />
)

export const FreeDoom2Icon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <GameIcon src={freedoom2} game="FreeDoom 2" title="FREEDOOM: PHASE 2" className={className} />
)

export const FreeDMIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <GameIcon src={freedm} game="FreeDM" title="FREEDM" className={className} />
)

export const PlutoniaIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <GameIcon src={plutonia} game="Plutonia" title="Plutonia Project" className={className} />
)

export const TntIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <GameIcon src={tnt} game="TNT" title="TNT Evilution" className={className} />
)

export const HexenIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <GameIcon src={hexen} game="Hexen" title="Hexen" className={className} />
)

export const HexenDDayIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <GameIcon
    src={hexdd}
    game="Hexen DDay"
    title="Hexen: Deathkings of the Shadow Realm"
    className={className}
  />
)

export const HereticIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <GameIcon src={heretic} game="Heretic" title="Heretic" className={className} />
)

export const StrifeIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <GameIcon src={strife} game="Strife" title="Strife" className={className} />
)

export const DefaultWadIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <GameIcon src={defaultIcon} className={className} />
)

export const ChexIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <GameIcon src={chex} game="Chex Quest" title="CHEX QUEST" className={className} />
)

export const Chex2Icon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <GameIcon src={chex2} game="Chex Quest 2" title="CHEX QUEST 2" className={className} />
)

export const Chex3Icon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <GameIcon src={chex3} game="Chex Quest 3" title="CHEX QUEST 3" className={className} />
)

interface DoomVersionIconProps {
  version: string
  customIcon?: string
  className?: string
}

export const DoomVersionIcon: React.FC<DoomVersionIconProps> = ({
  version,
  customIcon,
  className
}) => {
  const { t } = useTranslate('desktop')
  // Only treat as a custom file path if it contains slashes (is an absolute path)
  const isCustomPath = customIcon && (customIcon.includes('/') || customIcon.includes('\\'))

  if (isCustomPath) {
    return (
      <img
        src={toFileUrl(customIcon!)}
        alt={t('icons.customWad', 'Custom WAD Icon')}
        className={`${className || 'w-8 h-8'} object-contain aspect-square`}
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    )
  }

  switch (version) {
    case 'doom':
      return <DoomIcon className={className} />
    case 'doom2':
      return <Doom2Icon className={className} />
    case 'freedoom1':
    case 'freedoom':
      return <FreeDoomIcon className={className} />
    case 'freedoom2':
      return <FreeDoom2Icon className={className} />
    case 'freedm':
      return <FreeDMIcon className={className} />
    case 'plutonia':
      return <PlutoniaIcon className={className} />
    case 'tnt':
      return <TntIcon className={className} />
    case 'heretic':
      return <HereticIcon className={className} />
    case 'hexen':
      return <HexenIcon className={className} />
    case 'hexen-deathkings':
    case 'hexdd':
      return <HexenDDayIcon className={className} />
    case 'strife':
    case 'strife1':
      return <StrifeIcon className={className} />
    case 'chex':
      return <ChexIcon className={className} />
    case 'chex2':
      return <Chex2Icon className={className} />
    case 'chex3':
      return <Chex3Icon className={className} />
    default:
      return <DefaultWadIcon className={className} />
  }
}
