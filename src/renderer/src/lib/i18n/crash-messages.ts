import { getTranslate } from './index'
import { inferCrashHint } from '@/lib/crashHints'
import type { CrashLogActionPayload } from '@/lib/notifications'

/** Only format presentation: preserve the captured log, exit code and protocol identity. */
export function getCrashText(data: CrashLogActionPayload) {
  const { t } = getTranslate('desktop')
  const seconds = data.sessionSeconds
  const code = data.exitCode
  const hint = inferCrashHint(data.logTail)
  return {
    title: t('crash.title', 'crash_log — {protocol}', {
      protocol: data.protocolName || t('crash.unknownProtocol', 'unknown_protocol')
    }),
    termination:
      code === null
        ? t('crash.signalSummary', 'Terminated by a signal after {seconds, number}s', { seconds })
        : t(
            'crash.exitSummary',
            'Terminated with exit code {code, number} after {seconds, number}s',
            { code, seconds }
          ),
    hint,
    toastDescription: hint
      ? code === null
        ? t('crash.signalWithHint', '{hint} (signal after {seconds, number}s)', { hint, seconds })
        : t('crash.exitWithHint', '{hint} (exit code {code, number} after {seconds, number}s)', {
            hint,
            code,
            seconds
          })
      : code === null
        ? t(
            'crash.signalToast',
            'The game process terminated by a signal after {seconds, number}s of playtime.',
            { seconds }
          )
        : t(
            'crash.exitToast',
            'The game process terminated with exit code {code, number} after {seconds, number}s of playtime.',
            { code, seconds }
          )
  }
}
