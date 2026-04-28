import { useEffect } from "react";

// Placeholder sync hook. Later this will wire Yjs/Socket.IO.
export default function useTldrawSync(workspaceId, appRef) {
  useEffect(() => {
    if (!appRef || !appRef.current) return;
    const app = appRef.current;

    // simple autosave to sessionStorage for local persistence
    const saveInterval = setInterval(() => {
      try {
        const snapshot = app.json;
        sessionStorage.setItem(
          `tldraw:${workspaceId}:snapshot`,
          JSON.stringify(snapshot),
        );
      } catch (e) {
        // ignore
      }
    }, 2000);

    // hydrate from snapshot if present
    try {
      const raw = sessionStorage.getItem(`tldraw:${workspaceId}:snapshot`);
      if (raw) {
        const data = JSON.parse(raw);
        // apply without broadcasting
        app.loadDocument(data);
      }
    } catch (e) {
      // ignore
    }

    return () => clearInterval(saveInterval);
  }, [workspaceId, appRef]);
}
