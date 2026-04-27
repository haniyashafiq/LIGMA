import React, { createContext, useState, useCallback } from "react";

export const AppContext = createContext({});

export function AppProvider({ children }) {
  const [token, setToken] = useState(null);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);

  // jumpToNode function will be set by CanvasView
  const [jumpFn, setJumpFn] = useState(null);
  const exposeJump = useCallback((fn) => setJumpFn(() => fn), []);

  return (
    <AppContext.Provider
      value={{
        token,
        setToken,
        currentWorkspace,
        setCurrentWorkspace,
        connectionStatus,
        setConnectionStatus,
        taskPanelOpen,
        setTaskPanelOpen,
        jumpToNode: jumpFn,
        exposeJump,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
