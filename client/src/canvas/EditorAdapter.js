export function createEditorAdapter() {
  let editor = null;

  function getCameraSnapshot() {
    if (!editor || typeof editor.getCamera !== 'function') {
      return { x: 0, y: 0, z: 1 };
    }

    const camera = editor.getCamera();
    return {
      x: Number(camera?.x) || 0,
      y: Number(camera?.y) || 0,
      z: Number(camera?.z) || 1,
    };
  }

  return {
    attach(nextEditor) {
      editor = nextEditor || null;
      return editor;
    },
    detach() {
      editor = null;
    },
    getEditor() {
      return editor;
    },
    getViewportSnapshot() {
      return getCameraSnapshot();
    },
    screenToWorld(x, y) {
      if (!editor || typeof editor.screenToPage !== 'function') {
        return { x, y };
      }

      return editor.screenToPage({ x, y });
    },
    worldToScreen(x, y) {
      if (!editor || typeof editor.pageToScreen !== 'function') {
        return { x, y };
      }

      return editor.pageToScreen({ x, y });
    },
    animateTo(x, y, zoom = 1) {
      if (!editor) {
        return;
      }

      const nextCamera = { x, y, z: zoom };

      if (typeof editor.animateTo === 'function') {
        editor.animateTo(nextCamera);
        return;
      }

      if (typeof editor.setCamera === 'function') {
        editor.setCamera(nextCamera, { animation: { duration: 300 } });
      }
    },
  };
}
