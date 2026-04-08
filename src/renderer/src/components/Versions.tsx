import { useState } from 'react'

interface ElectronProcess {
  versions: {
    electron: string
    chrome: string
    node: string
  }
}

function Versions(): React.JSX.Element {
  const electronProcess = window.electron.process as ElectronProcess
  const [versions] = useState(electronProcess?.versions)

  return (
    <ul className="versions">
      <li className="electron-version">Electron v{versions.electron}</li>
      <li className="chrome-version">Chromium v{versions.chrome}</li>
      <li className="node-version">Node v{versions.node}</li>
    </ul>
  )
}

export default Versions
