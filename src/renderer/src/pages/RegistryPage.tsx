import React, { useCallback } from 'react'
import { useLocation } from 'wouter'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { REGISTRY_FRONTEND_URL } from '@shared/registry-config'
import { useRegistryInstallHandoff } from '@/lib/install/registryInstall'

/**
 * Registry browse view — embeds the registry frontend in an iframe. The
 * frontend detects embedded mode via ?embedded=1 and hands "Install Protocol"
 * clicks back to us as postMessage (uac-install), which
 * useRegistryInstallHandoff routes to the install page.
 */
export const RegistryPage: React.FC = () => {
  const [, setLocation] = useLocation()
  // Explicit tab intent: wouter's navigate() keeps any pre-existing ?tab=
  // (e.g. a previous visit's ?tab=files) — without stating the target tab,
  // a registry install would land back on the stale tab instead of the
  // Configuration default where the pre-filled form lives.
  const handleInstall = useCallback(() => setLocation('/install?tab=install'), [setLocation])
  useRegistryInstallHandoff(handleInstall)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeVersion={null} onVersionSelect={() => {}} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onSearch={() => {}} />

        <div className="flex-1 min-h-0">
          <iframe
            src={`${REGISTRY_FRONTEND_URL}?embedded=1`}
            title="UAC Registry"
            className="w-full h-full border-0"
            allow="fullscreen"
          />
        </div>
      </div>
    </div>
  )
}

export default RegistryPage
