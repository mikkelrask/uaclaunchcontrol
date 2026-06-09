export interface AddFormState {
  name: string
  filePath: string
  fileType: string
  version: string
  url: string
  loadOrder: RequiredModEntry[]
  sidecarOnly: boolean
}

export interface EditFormState {
  name: string
  version: string
  url: string
  loadOrder: RequiredModEntry[]
  sidecarOnly: boolean
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
