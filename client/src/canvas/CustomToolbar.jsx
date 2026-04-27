import React, { useContext } from 'react'
import '../styles/canvas.css'
import { AppContext } from '../utils/AppContext'

export default function CustomToolbar({ store }) {
  const { taskPanelOpen, setTaskPanelOpen, setConnectionStatus } = useContext(AppContext)

  function toggleTaskPanel() {
    setTaskPanelOpen(!taskPanelOpen)
  }

  function toggleMembers() {
    // For now, toggle connectionStatus as a placeholder for opening members
    setConnectionStatus((s) => (s === 'connected' ? 'disconnected' : 'connected'))
  }

  function selectTool(tool) {
    try {
      const editor = store?.getEditor ? store.getEditor() : null
      if (editor && typeof editor.selectTool === 'function') {
        editor.selectTool(tool)
      } else if (store && typeof store.setSelectedTool === 'function') {
        store.setSelectedTool(tool)
      } else {
        console.debug('[CustomToolbar] tool switch not available', tool)
      }
    } catch (e) {
      console.error('[CustomToolbar] failed to select tool', e)
    }
  }

  return (
    <div className="canvas-toolbar">
      <button className="tool-btn" onClick={() => selectTool('select')}>Select</button>
      <button className="tool-btn" onClick={() => selectTool('sticky')}>Sticky</button>
      <button className="tool-btn" onClick={() => selectTool('text')}>Text</button>
      <button className="tool-btn" onClick={() => selectTool('draw')}>Draw</button>
      <button className="tool-btn" onClick={() => selectTool('shape')}>Shape</button>
      <div className="toolbar-spacer" />
      <button className="tool-btn" onClick={toggleTaskPanel}>{taskPanelOpen ? 'Close Tasks' : 'Tasks'}</button>
      <button className="tool-btn" onClick={toggleMembers}>Members</button>
    </div>
  )
}
