import { getTranslate } from './index'

export function getCategoryLabel(value: string): string {
  const { t } = getTranslate('desktop')
  const labels: Record<string, string> = {
    total_conversion: t('catalog.category.total_conversion', 'Total Conversion'),
    expansion: t('catalog.category.expansion', 'Expansion'),
    weapon: t('catalog.category.weapon', 'Weapon'),
    mapset: t('catalog.category.mapset', 'Mapset'),
    asset_pack: t('catalog.category.asset_pack', 'Asset Pack'),
    gameplay: t('catalog.category.gameplay', 'Gameplay'),
    hud: t('catalog.category.hud', 'HUD'),
    other: t('catalog.category.other', 'Other')
  }
  return labels[value] ?? value
}

export function getCatalogColumnLabel(value: string): string {
  const { t } = getTranslate('desktop')
  const labels: Record<string, string> = {
    name: t('common.labels.name', 'Name'),
    version: t('common.labels.version', 'Version'),
    fileType: t('common.labels.fileType', 'Type'),
    category: t('common.labels.category', 'Category'),
    config: t('common.labels.config', 'Config'),
    dependencies: t('common.labels.loadOrder', 'Load Order'),
    hashValue: t('common.labels.md5Checksum', 'MD5 Checksum'),
    actions: t('common.labels.actions', 'Actions')
  }
  return labels[value] ?? value
}
