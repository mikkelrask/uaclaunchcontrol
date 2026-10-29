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
    name: t('catalog.columnLabel.name', 'Name'),
    version: t('catalog.columnLabel.version', 'Version'),
    fileType: t('catalog.columnLabel.fileType', 'Type'),
    category: t('catalog.columnLabel.category', 'Category'),
    config: t('catalog.columnLabel.configTemplate', 'Config'),
    dependencies: t('catalog.columnLabel.loadOrder', 'Load Order'),
    hashValue: t('catalog.columnLabel.hashValue', 'MD5 Checksum'),
    actions: t('catalog.columnLabel.actions', 'Actions')
  }
  return labels[value] ?? value
}
