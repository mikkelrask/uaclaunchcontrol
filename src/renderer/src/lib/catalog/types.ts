export interface AddFormState {
  name: string
  filePath: string
  fileType: string
  version: string
  url: string
  loadOrder: RequiredModEntry[]
  sidecarOnly: boolean
  category: string
  /** Config template to link with this mod file */
  configTemplate: {
    filePath: string  // Source path (for display / re-upload)
    configFile: string // Stored filename in cfgs/
    md5Hash: string    // MD5 hash
  } | null
}

export interface EditFormState {
  name: string
  version: string
  url: string
  loadOrder: RequiredModEntry[]
  sidecarOnly: boolean
  category: string
  configTemplate: {
    filePath: string
    configFile: string
    md5Hash: string
  } | null
}

export interface RequiredModEntry {
  hash: string
  name: string
  filePath: string
  isNew: boolean
  offset: number
  sidecarOnly: boolean
  isMain?: boolean
}

export interface DialogFormState {
  name: string
  filePath?: string
  fileType?: string
  version: string
  url: string
  loadOrder: RequiredModEntry[]
  sidecarOnly: boolean
}
