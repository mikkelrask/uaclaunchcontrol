import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslate } from '@tolgee/react'
import { ArrowLeft, Check, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SettingsResourceWorkbenchProps {
  listLabel: string
  list: ReactNode
  editor: ReactNode
  detailOpen: boolean
  onBack: () => void
  count?: number
}

export function SettingsResourceWorkbench({
  listLabel,
  list,
  editor,
  detailOpen,
  onBack,
  count
}: SettingsResourceWorkbenchProps): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslate('desktop')
  const backRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (detailOpen && backRef.current?.getClientRects().length)
      backRef.current.focus({ preventScroll: true })
  }, [detailOpen])
  return (
    <div className="settings-resource-workbench" data-detail-open={detailOpen}>
      <section className="settings-resource-library" aria-label={listLabel}>
        <div className="settings-resource-panel-heading">
          <span>{listLabel}</span>
          <span>{count}</span>
        </div>
        <div
          ref={listRef}
          className="settings-resource-list settings-scroll"
          data-settings-resource-list
        >
          {list}
        </div>
      </section>
      <section
        className="settings-resource-inspector"
        aria-label={t('settings.resources.configuration', 'Configuration')}
      >
        <div className="settings-resource-panel-heading">
          <span>{t('settings.resources.configuration', 'Configuration')}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="settings-resource-back"
            ref={backRef}
            data-settings-back
            onClick={() => {
              onBack()
              requestAnimationFrame(() =>
                listRef.current
                  ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
                  ?.focus({ preventScroll: true })
              )
            }}
          >
            <ArrowLeft aria-hidden="true" />
            {t('settings.resources.back', 'Back to list')}
          </Button>
        </div>
        <div className="settings-resource-editor settings-scroll" data-settings-editor>
          {editor}
        </div>
      </section>
    </div>
  )
}

export function SettingsDefaultControl({
  isDefault,
  onSelect
}: {
  isDefault: boolean
  onSelect: () => void
}): React.JSX.Element {
  const { t } = useTranslate('desktop')
  return (
    <div className="settings-default-row">
      <span>{t('settings.resources.newProtocols', 'Use for new protocols')}</span>
      <Button
        type="button"
        variant="outline"
        className="settings-default-control"
        data-settings-default
        aria-disabled={isDefault}
        onClick={() => {
          if (!isDefault) onSelect()
        }}
      >
        {isDefault ? <Check aria-hidden="true" /> : <Star aria-hidden="true" />}
        <span className="settings-default-labels">
          <span className={isDefault ? 'invisible' : ''} aria-hidden={isDefault}>
            {t('settings.resources.makeDefault', 'Make default')}
          </span>
          <span className={isDefault ? '' : 'invisible'} aria-hidden={!isDefault}>
            {t('settings.resources.default', 'Default')}
          </span>
        </span>
      </Button>
    </div>
  )
}
