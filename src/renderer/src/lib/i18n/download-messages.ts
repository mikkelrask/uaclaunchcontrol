import { getTranslate } from './index'
import type { ModDownloadEvent } from '@shared/modDownload'

/** Translate display state only; filenames, IPC states and diagnostic details stay intact. */
export function getDownloadText(
  event: ModDownloadEvent,
  fileName?: string
): { title: string; error?: string } {
  const { t } = getTranslate('desktop')
  switch (event.state) {
    case 'preparing':
      return {
        title:
          event.phase === 'waiting-for-moddb'
            ? t('downloads.waitingForModdb', 'Waiting for ModDB to start the download…')
            : event.message
      }
    case 'completed':
      return {
        title: event.filePath
          ? t('downloads.complete', 'Download complete')
          : event.alreadyInCatalog
            ? t('downloads.alreadyCataloged', 'Already in catalog')
            : t('downloads.addedToCatalog', 'Added to catalog')
      }
    case 'cancelled':
      return { title: t('downloads.cancelled', 'Download cancelled') }
    case 'error':
      return {
        title: t('downloads.failed', 'Download failed'),
        error:
          event.reason?.code === 'browser-fallback'
            ? t(
                'downloads.browserFallback',
                'Download did not start — opening in your browser instead'
              )
            : event.reason?.code === 'interrupted'
              ? t('downloads.interrupted', 'Download interrupted ({state})', {
                  state: event.reason.state
                })
              : t('downloads.errorDetails', 'Could not complete the download: {error}', {
                  error: event.message
                })
      }
    default:
      return { title: fileName || t('downloads.downloading', 'Downloading…') }
  }
}
