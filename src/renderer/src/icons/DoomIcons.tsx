import React from 'react'
import doom from './doom.png'
import doom2 from './doom2.png'
import freedoom from './freedoom1.png'
import freedoom2 from './freedoom2.png'
import plutonia from './plutonia.png'
import tnt from './tnt.png'
import hexen from './hexen.png'
import hexdd from './hexdd.png'
import heretic from './heretic.png'
import strife from './strife1.png'
import defaultIcon from './default.png'
import { toFileUrl } from '@/lib/utils'

interface DoomIconProps {
  className?: string
}

export const DoomIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <img src={doom} alt="Doom Icon" title="DOOM" className={className} />
)

export const Doom2Icon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <img src={doom2} alt="Doom 2 Icon" title="DOOM II" className={className} />
)

export const FreeDoomIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <img src={freedoom} alt="FreeDoom Icon" title="FREEDOOM: PHASE 1" className={className} />
)

export const FreeDoom2Icon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <img src={freedoom2} alt="FreeDoom 2 Icon" title="FREEDOOM: PHASE 2" className={className} />
)

export const PlutoniaIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <img src={plutonia} alt="Plutonia Icon" title="Plutonia Project" className={className} />
)

export const TntIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <img src={tnt} alt="TNT Icon" title="TNT Evilution" className={className} />
)

export const HexenIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <img src={hexen} alt="Hexen Icon" title="Hexen" className={className} />
)

export const HexenDDayIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <img src={hexdd} alt="Hexen DDay Icon" title="Hexen: Deathkings of the Shadow Realm" className={className} />
)

export const HereticIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <img src={heretic} alt="Heretic Icon" title="Heretic" className={className} />
)

export const StrifeIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <img src={strife} alt="Strife Icon" title="Strife" className={className} />
)

export const DefaultWadIcon: React.FC<DoomIconProps> = ({ className = 'w-8 h-8' }) => (
  <img src={defaultIcon} alt="Default WAD Icon" title="Doom Launcher" className={className} />
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
  // Only treat as a custom file path if it contains slashes (is an absolute path)
  const isCustomPath = customIcon && (customIcon.includes('/') || customIcon.includes('\\'))

  if (isCustomPath) {
    return (
      <img
        src={toFileUrl(customIcon!)}
        className={className || 'w-8 h-8 object-contain'}
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
    default:
      return <DefaultWadIcon className={className} />
  }
}
