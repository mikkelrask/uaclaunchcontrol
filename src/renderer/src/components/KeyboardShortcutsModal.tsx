import { T, useTranslate } from '@tolgee/react'
import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Keyboard, ExternalLink } from 'lucide-react'

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { t } = useTranslate('desktop')
  const shortcuts = [
    { key: '/', description: t('shortcuts.search', 'Focus search input') },
    { key: 'i', description: t('shortcuts.install', 'Go to Install page') },
    { key: 'm', description: t('shortcuts.modFiles', 'Go to Install > Mod Files tab') },
    { key: 'w', description: t('shortcuts.wadFiles', 'Go to Install > WAD Files tab') },
    { key: 'l', description: t('shortcuts.launch', 'Go to Launch page') },
    { key: 'Ctrl + .', description: t('shortcuts.settings', 'Open Settings') },
    { key: '?', description: t('shortcuts.help', 'Show this help') }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-app-primary shadow-2xl border-app max-w-md p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-app bg-app-secondary">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-highlight/10 rounded-md">
              <Keyboard className="w-5 h-5 text-accent-highlight" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-app-primary lowercase">
                {t('shortcuts.title', 'keyboard_protocols')}
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                {t('shortcuts.subtitle', 'UAC Launch Control // Shortcuts')}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-app-secondary rounded-lg border border-app"
            >
              <span className="text-sm text-app-primary">{shortcut.description}</span>
              <Kbd className="bg-app-primary border-app text-accent-highlight font-bold text-xs px-2 py-1">
                {shortcut.key}
              </Kbd>
            </div>
          ))}
        </div>

        <DialogFooter className="sm:justify-between items-center text-xs text-app-muted bg-app-secondary border-t border-app p-4 shrink-0">
          <T
            ns="desktop"
            keyName="shortcuts.moreInfo"
            defaultValue="For more info see {wiki}"
            params={{
              wiki: (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-accent-highlight hover:bg-accent-highlight/10 gap-1"
                  onClick={() => window.open('https://uac-soft.online/getting-started/', '_blank')}
                >
                  {t('shortcuts.wiki', 'Wiki')}
                  <ExternalLink className="w-3 h-3" />
                </Button>
              )
            }}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default KeyboardShortcutsModal
