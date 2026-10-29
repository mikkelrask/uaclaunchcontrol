import { T, useTranslate } from '@tolgee/react'
import { useId, type Dispatch, type SetStateAction } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import type { IAppSettings } from '@shared/schema'

export function SettingsThemeTab({
  settings,
  setSettings
}: {
  settings: IAppSettings
  setSettings: Dispatch<SetStateAction<IAppSettings>>
}): React.JSX.Element {
  const { t } = useTranslate('desktop')
  const { toast } = useToast()
  const id = useId()
  return (
    <>
      <div className="settings-section-heading">
        <div>
          <h2>{t('settings.themeLab.title', 'Theme lab')}</h2>
          <p>
            {t(
              'settings.themeLab.description',
              'Edit the palette used across the app. Changes preview live.'
            )}
          </p>
        </div>
      </div>
      <label htmlFor={`${id}-css`} className="mb-2 block text-sm">
        {t('settings.customTheme.title', 'CUSTOM THEME EDITOR')}
      </label>
      <textarea
        id={`${id}-css`}
        className="settings-code settings-scroll"
        value={settings.customThemeCss || ''}
        onChange={(e) => setSettings((s) => ({ ...s, customThemeCss: e.target.value }))}
        placeholder={`--bg-primary: 220 18% 5%;\n--text-primary: 210 20% 92%;\n--accent-highlight: 0 84% 60%;`}
        aria-label={t('settings.customTheme.title', 'CUSTOM THEME EDITOR')}
        spellCheck={false}
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSettings((s) => ({
              ...s,
              customThemeCss:
                s.customThemeCss && !/^\s*\.custom\s*\{/.test(s.customThemeCss)
                  ? `.custom {\n${s.customThemeCss}\n}`
                  : s.customThemeCss
            }))
          }}
          className="text-xs bg-app-primary hover:bg-app-hover text-app-primary border-app h-8"
        >
          {t('settings.customTheme.wrap', 'Wrap in {selector}', {
            selector: '.custom { }'
          })}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Copy dark theme values as a starter
            const darkThemeVars = [
              '--bg-primary: 220 18% 5%;',
              '--bg-secondary: 220 15% 9%;',
              '--bg-tertiary: 220 12% 14%;',
              '--bg-card: 220 18% 8%;',
              '--bg-popover: 220 18% 9%;',
              '--bg-muted: 220 10% 18%;',
              '--bg-sidebar: 220 18% 6%;',
              '--bg-hover: 220 12% 16%;',
              '',
              '--text-primary: 210 20% 92%;',
              '--text-secondary: 215 12% 70%;',
              '--text-muted: 215 10% 75%;',
              '--text-sidebar: 210 20% 92%;',
              '--text-card: 210 20% 92%;',
              '--text-popover: 210 20% 92%;',
              '',
              '--accent-highlight: 0 84% 60%;',
              '--accent-destructive: 0 65% 45%;',
              '',
              '--border: 220 12% 18%;'
            ].join('\n')
            setSettings((s) => ({
              ...s,
              customThemeCss: darkThemeVars
            }))
          }}
          className="text-xs bg-app-primary hover:bg-app-hover text-app-primary border-app h-8"
        >
          {t('settings.customTheme.reset', 'Reset to defaults')}
        </Button>
      </div>

      <details className="settings-theme-help">
        <summary>{t('settings.themeLab.reference', 'Syntax and variable reference')}</summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-app-muted leading-relaxed">
            <T
              ns="desktop"
              keyName="settings.customTheme.instructions"
              defaultValue="Paste HSL variable overrides below. Each line should follow the format: {format}Example: {example}Wrap the overrides in {wrapper} or just paste the variable lines — the app will wrap them automatically."
              params={{
                format: (
                  <code className="block font-mono text-xs mt-1 p-2 bg-app-primary rounded border border-app/50">
                    --variable-name: hue saturation lightness;
                  </code>
                ),
                example: (
                  <code className="block font-mono text-xs mt-1 p-2 bg-app-primary rounded border border-app/50 whitespace-pre">
                    --bg-primary: 220 18% 5%; --text-primary: 210 20% 92%; --accent-highlight: 0 84%
                    60%;
                  </code>
                ),
                wrapper: <code className="font-mono text-xs">{'.custom { ... }'}</code>
              }}
            />
          </p>
          <p className="text-xs text-app-muted leading-relaxed">
            <T
              ns="desktop"
              keyName="settings.customTheme.guideDescription"
              defaultValue="See the {guide} for the full variable reference and examples."
              params={{
                guide: (
                  <a
                    href="https://github.com/mikkelrask/uaclaunchcontrol/wiki/Theming#custom-theme"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-accent-highlight transition-colors"
                  >
                    {t('settings.customTheme.guide', 'Theming guide on GitHub')}
                  </a>
                )
              }}
            />
          </p>
        </div>
      </details>
      <div className="settings-strip">
        <p>{t('settings.themeLab.personnel', 'Authorised personnel only.')}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            toast({
              title: 'BLUE KEYCARD REQUIRED',
              description: t(
                'settings.themeLab.clearance',
                'Access denied. Please report to your nearest UAC security officer.'
              )
            })
          }
        >
          {t('settings.config.restricted', 'RESTRICTED AREA')}
        </Button>
      </div>
    </>
  )
}
