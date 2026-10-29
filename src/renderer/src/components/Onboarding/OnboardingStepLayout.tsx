import { useId, type ReactNode } from 'react'

interface OnboardingStepLayoutProps {
  id: string
  title: ReactNode
  kicker?: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer: ReactNode
  scroll?: boolean
}

export function OnboardingStepLayout({
  id,
  title,
  kicker,
  description,
  children,
  footer,
  scroll = true
}: OnboardingStepLayoutProps): React.JSX.Element {
  const titleId = useId()
  return (
    <section className="onboarding-step" data-onboarding-step={id} aria-labelledby={titleId}>
      <header className="onboarding-step-heading">
        {kicker && <span className="onboarding-kicker">{kicker}</span>}
        <h2 id={titleId} tabIndex={-1}>
          {title}
        </h2>
        {description && <div className="onboarding-description">{description}</div>}
      </header>
      <div
        className={`onboarding-step-body settings-scroll${scroll ? '' : ' onboarding-step-body-workbench'}`}
      >
        {children}
      </div>
      <footer className="onboarding-step-footer">{footer}</footer>
    </section>
  )
}
