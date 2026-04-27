// Minimal tldraw sync server stub.
// This file is a scaffold for integrating the tldraw TLSocketAdapter
// and bridging tldraw store changes into the server's Yjs event store.

const WebSocket = require("ws");

module.exports = function attachTldrawSync(
  server,
  { eventService, authService },
) {
  const wss = new WebSocket.Server({ noServer: true });

  server.on("upgrade", async (request, socket, head) => {
    // expect path: /ws/tldraw/:workspaceId
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (!url.pathname.startsWith("/ws/tldraw")) return;

    // basic token check (query param `token`)
    const token = url.searchParams.get("token");
    try {
      const user = await authService.verifyToken(token);
      // accept the connection
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request, { user });
      });
    } catch (e) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });

  wss.on("connection", (ws, req, meta) => {
    // TODO: create TLSocketAdapter here and wire to Yjs doc + eventService
    const user = meta && meta.user;
    console.log("[tldraw-sync] connection", user && user.id);

    ws.on("message", (data) => {
      // for now just log messages; real implementation uses TLSocketAdapter
      console.log("[tldraw-sync] message length", data.length);
    });

    ws.on("close", () => {});
  });

  return wss;
};
