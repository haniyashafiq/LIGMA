import React, { useEffect, useRef, useContext } from "react";
import { Tldraw } from "@tldraw/tldraw";
import { useSync } from "@tldraw/sync";
import CustomToolbar from "../canvas/CustomToolbar";
import useCanvasSync from "../canvas/useCanvasSync";
import { AppContext } from "../utils/AppContext";
import "../styles/canvas.css";

export default function CanvasView({ workspaceId }) {
  const { token, exposeJump } = useContext(AppContext);
  const editorRef = useRef(null);

  // create a tldraw sync store connected to our server (placeholder uri)
  const store = useSync({
    uri: `ws://localhost:3000/ws/tldraw/${workspaceId}?token=${token}`,
  });

  // client-side sync hook (listens and emits AI events)
  useCanvasSync(store, workspaceId);

  useEffect(() => {
    if (!store) return;
    // expose jumpToNode via context for TaskBoard to call
    const jumpToNode = (nodeId) => {
      try {
        const editor = store.getEditor();
        const shape = editor.getShape(nodeId);
        if (!shape) return;
        const bounds = editor.getShapePageBounds(shape);
        editor.zoomToBounds(bounds, { animation: { duration: 500 } });
      } catch (e) {
        // ignore
      }
    };
    if (exposeJump) exposeJump(jumpToNode);
  }, [store, exposeJump]);

  return (
    <div className="canvas-root">
      <div className="canvas-toolbar-wrap">
        <CustomToolbar store={store} />
      </div>
      <div className="canvas-container">
        {store ? <Tldraw store={store} /> : <div>Loading canvas…</div>}
      </div>
    </div>
  );
}
