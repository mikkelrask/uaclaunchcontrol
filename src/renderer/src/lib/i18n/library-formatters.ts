import { useTranslate, useTolgee } from '@tolgee/react'

export function useLibraryFormatters() {
  const { t } = useTranslate('desktop')
  const tolgee = useTolgee(['language'])
  const locale = tolgee.getLanguage()
  const absoluteDate = (iso: string): string =>
    new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
  const formatDate = (iso: string): string => {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '—'
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000))
    if (days === 0) return t('library.time.today', 'Today')
    if (days === 1) return t('library.time.yesterday', 'Yesterday')
    if (days < 7)
      return t('library.time.daysAgo', '{count, plural, one {# day ago} other {# days ago}}', {
        count: days
      })
    if (days < 30)
      return t('library.time.weeksAgo', '{count, plural, one {# week ago} other {# weeks ago}}', {
        count: Math.floor(days / 7)
      })
    return absoluteDate(iso)
  }
  const formatPlaytime = (seconds?: number): string | null => {
    if (!seconds || seconds <= 0) return null
    return t('library.time.totalHours', 'Total: {hours} hrs', {
      hours: new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(seconds / 3600)
    })
  }
  return { formatDate, formatPlaytime, absoluteDate }
}
