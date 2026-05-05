import React from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Keyboard, ExternalLink } from 'lucide-react'

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  const shortcuts = [
    { key: '/', description: 'Focus search input' },
    { key: 'i', description: 'Go to Install page' },
    { key: 'l', description: 'Go to Launch page' },
    { key: 'Ctrl + .', description: 'Open Settings' },
    { key: '?', description: 'Show this help' }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-app bg-app-primary shadow-2xl">
        <div className="flex items-center gap-3 p-4 border-b border-app bg-app-secondary">
          <div className="p-2 bg-accent-highlight/10 rounded-md">
            <Keyboard className="w-5 h-5 text-accent-highlight" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight text-app-primary lowercase">
              keyboard_protocols
            </DialogTitle>
            <p className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
              UAC Launch Control // Shortcuts
            </p>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-app-secondary rounded-lg border border-app"
            >
              <span className="text-sm text-app-primary">{shortcut.description}</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-app-primary border border-app rounded-md text-accent-highlight font-bold">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-app bg-app-secondary flex items-center justify-between">
          <span className="text-xs text-app-muted">For more info see</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-accent-highlight hover:bg-accent-highlight/10 gap-1"
            onClick={() =>
              window.open('https://github.com/mikkelrask/uaclaunchcontrol/wiki', '_blank')
            }
          >
            Wiki
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default KeyboardShortcutsModal
