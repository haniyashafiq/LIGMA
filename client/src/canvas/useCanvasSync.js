import { useEffect } from "react";

// Hook that listens to the tldraw store and emits app-level events.
// For now it uses store.listen() and logs user-originated entries.
export default function useCanvasSync(store, workspaceId) {
  useEffect(() => {
    if (!store) return;

    const onChange = (entry) => {
      try {
        // tldraw entries include .source === 'local' | 'remote'
        if (entry.source === "remote") return;

        // Simple handling: log create/update/delete for later wiring to Socket.IO
        if (entry.type === "shape") {
          // entry.subtype may indicate create/update/delete depending on API
          console.log("[useCanvasSync] local shape entry", entry);
        } else {
          console.log("[useCanvasSync] entry", entry);
        }
        // TODO: emit via Socket.IO client to server for RBAC + event store
      } catch (e) {
        // swallow
      }
    };

    const unlisten = store.listen(onChange);
    return () => {
      try {
        unlisten();
      } catch (e) {}
    };
  }, [store, workspaceId]);
}
