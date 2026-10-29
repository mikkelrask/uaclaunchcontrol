import { useTranslate } from '@tolgee/react'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { DoomVersionIcon } from '@/icons/DoomIcons'
import { IDoomVersion } from '@shared/schema'
import logo from '../icons/icon.png'
import { api } from '@/api'

interface SidebarProps {
  activeVersion: string | null
  onVersionSelect: (versionId: string) => void // Pass numeric version ID
}

export const Sidebar: React.FC<SidebarProps> = ({ activeVersion, onVersionSelect }) => {
  const { t } = useTranslate('desktop')
  const { data: versions = [], isLoading } = useQuery<IDoomVersion[]>({
    queryKey: ['/api/versions'],
    queryFn: api.getDoomVersions
  })

  return (
    <div className="w-20 bg-app-primary h-full flex flex-col items-center py-6 border-r border-app-secondary overflow-y-auto scrollbar-hide min-h-0">
      {/* App Logo - stays at top */}
      <div className="w-12 h-12 mb-12 bg-app-secondary rounded-md flex items-center justify-center shrink-0">
        <img src={logo} alt={t('sidebar.logo', 'Logo')} className="w-12 h-12" />
      </div>

      {/* Doom Version Filters - scrolls if needed */}
      <div className="flex flex-col space-y-6 shrink-0">
        {isLoading ? (
          <p>{t('sidebar.loading', 'Loading...')}</p>
        ) : (
          versions
            .filter((v) => !v.ignored)
            .map((version) => (
              <div
                key={version.id}
                className={`sidebar-icon ${activeVersion === version.id ? 'active' : ''}`}
                onClick={() => onVersionSelect(version.id)}
              >
                <DoomVersionIcon version={version.slug} customIcon={version.icon} />
                <span className="sr-only">{version.name}</span>
              </div>
            ))
        )}
      </div>
    </div>
  )
}

export default Sidebar
