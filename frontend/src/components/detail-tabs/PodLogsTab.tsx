import { useState, memo } from 'react'
import { LogTerminalView } from '#/components/logs/LogTerminalView'

type PodLogsTabProps = {
  namespace: string
  podName: string
  containers: string[]
}

export const PodLogsTab = memo(function PodLogsTab({ namespace, podName, containers }: PodLogsTabProps) {
  const [selectedContainer, setSelectedContainer] = useState(
    containers.find((c) => !c.startsWith('init-')) ?? containers[0] ?? '',
  )
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={expanded ? 'h-[calc(100vh-200px)]' : 'h-[calc(100vh-340px)]'}>
      <LogTerminalView
        namespace={namespace}
        podName={podName}
        containers={containers}
        selectedContainer={selectedContainer}
        onContainerChange={setSelectedContainer}
        expanded={expanded}
        onExpandToggle={() => setExpanded((v) => !v)}
      />
    </div>
  )
})
