export const CATEGORIES = [
  'total_conversion',
  'expansion',
  'weapon',
  'mapset',
  'asset_pack',
  'gameplay',
  'hud',
  'other'
] as const

export type ModCategory = (typeof CATEGORIES)[number]
