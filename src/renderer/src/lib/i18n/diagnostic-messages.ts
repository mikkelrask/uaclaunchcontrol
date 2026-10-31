import { getTranslate } from './index'

/** Translate the heading only; diagnostic codes remain stable, searchable tokens. */
export function getDiagnosticTitle(level: 'system' | 'warning' | 'fatal', code: string): string {
  const { t } = getTranslate('desktop')
  switch (level) {
    case 'system':
      return t('notifications.status.system', 'SYSTEM: {code}', { code })
    case 'warning':
      return t('notifications.status.caution', 'WARNING: {code}', { code })
    case 'fatal':
      return t('notifications.status.fatal', 'FATAL: {code}', { code })
  }
}
