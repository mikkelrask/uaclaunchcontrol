import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { useToast } from '@/hooks/use-toast'
import { dispatchAchievementEvent, buildUnlockToasts } from '@/lib/achievements'
import type { IProtocol, IModFile, InsertModFile } from '@shared/schema'

interface UseProtocolActionsArgs {
  protocolId: string
  protocol: IProtocol
  files: InsertModFile[]
  onClose: () => void
  onConfigCreated: (result: { configFile: string; templateHash?: string }) => void
}

interface UseProtocolActionsResult {
  handleSave: () => void
  handleDelete: () => void
  handleLaunch: () => void
  handleCreateFreshConfig: () => Promise<void>
  isSaving: boolean
  isDeleting: boolean
  isLaunching: boolean
  isCreatingConfig: boolean
}

/** Save/delete/test-launch/create-config actions for the protocol settings modal. */
export function useProtocolActions({
  protocolId,
  protocol,
  files,
  onClose,
  onConfigCreated
}: UseProtocolActionsArgs): UseProtocolActionsResult {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isCreatingConfig, setIsCreatingConfig] = useState(false)

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      protocol,
      files
    }: {
      id: string
      protocol: Partial<IProtocol>
      files: Omit<IModFile, 'id' | 'modId'>[]
    }) => api.updateProtocol(id, protocol, files),
    onSuccess: async (updatedProtocol, variables) => {
      toast({
        title: 'SYSTEM: protocol_saved',
        description: 'Protocol settings successfully saved.'
      })
      queryClient.invalidateQueries({ queryKey: ['/api/protocols'] })
      queryClient.setQueryData([`/api/protocols/${variables.id}`], {
        protocol: updatedProtocol,
        files: variables.files
      })

      // Dispatch achievement event for PROTOCOL_UPDATED — edits can push a
      // protocol's file count past thresholds that creation didn't reach.
      try {
        const result = await dispatchAchievementEvent({
          type: 'PROTOCOL_UPDATED',
          fileCount: variables.files.length
        })

        const unlockToasts = buildUnlockToasts(result)
        for (const t of unlockToasts) {
          toast({
            title: t.title,
            description: t.description,
            duration: t.duration as 6000 | 8000
          })
        }
      } catch (err) {
        // Fire-and-forget: don't block the save flow on achievement failures
        console.error('Achievement dispatch failed:', err)
      }

      onClose()
    },
    onError: (error) => {
      toast({
        title: 'FATAL: settings.save()',
        description: `Failed to save changes: ${error}`,
        variant: 'destructive'
      })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProtocol(id),
    onSuccess: () => {
      toast({
        title: 'SYSTEM: delete_protocol',
        description: 'Protocol deleted successfully'
      })
      queryClient.invalidateQueries({ queryKey: ['/api/protocols'] })
      onClose()
    },
    onError: (error) => {
      toast({
        title: 'FATAL: delete_failed',
        description: `Failed to delete protocol: ${error}`,
        variant: 'destructive'
      })
    }
  })

  // Launch mutation — test-launches the current in-memory state (including
  // any unsaved edits), same as InstallPage's Test button. Lets you try
  // changes before committing to Save Changes.
  const launchMutation = useMutation({
    mutationFn: () => api.testLaunch(protocol, files),
    onSuccess: () => {
      toast({
        title: 'SYSTEM: launch_protocol',
        description: `Process "${protocol.title}" is now running`
      })
    },
    onError: (error) => {
      toast({
        title: 'FATAL: launch_protocol',
        description: `Failed to launch protocol: "${error}"`,
        variant: 'destructive'
      })
    }
  })

  const handleSave = (): void => {
    const filesWithoutIds = files.map((f) => ({
      name: f.name,
      fileName: f.fileName,
      filePath: f.filePath,
      fileType: f.fileType,
      loadOrder: f.loadOrder,
      isRequired: f.isRequired,
      hashValue: f.hashValue,
      url: f.url || ''
    }))

    updateMutation.mutate({
      id: protocolId,
      protocol,
      files: filesWithoutIds
    })
  }

  const handleDelete = (): void => {
    deleteMutation.mutate(protocolId)
  }

  const handleLaunch = (): void => {
    launchMutation.mutate()
  }

  // Creates the file immediately (same as the screenshot upload), but only
  // takes effect on the protocol once Save Changes is hit — consistent with
  // how every other edit in this modal works.
  const handleCreateFreshConfig = async (): Promise<void> => {
    setIsCreatingConfig(true)
    try {
      const result = await api.createBlankConfig(protocolId)
      onConfigCreated(result)
      toast({
        title: 'SYSTEM: config_created',
        description: 'Fresh isolated config created. Click Save Changes to apply.'
      })
    } catch (error) {
      toast({
        title: 'FATAL: config_create_failed',
        description: `Failed to create config: ${error}`,
        variant: 'destructive'
      })
    } finally {
      setIsCreatingConfig(false)
    }
  }

  return {
    handleSave,
    handleDelete,
    handleLaunch,
    handleCreateFreshConfig,
    isSaving: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isLaunching: launchMutation.isPending,
    isCreatingConfig
  }
}
