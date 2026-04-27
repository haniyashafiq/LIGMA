import React, { createContext, useState, useCallback } from "react";
import { useEffect } from "react";

export const AppContext = createContext({});

export function AppProvider({ children }) {
  const [token, setToken] = useState(null);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState([]);

  // jumpToNode function will be set by CanvasView
  const [jumpFn, setJumpFn] = useState(null);
  const exposeJump = useCallback((fn) => setJumpFn(() => fn), []);

  useEffect(() => {
    function onPresence(e) {
      try {
        const members = e?.detail?.members || [];
        setMembers(members);
      } catch (err) {
        // ignore
      }
    }

    window.addEventListener("ligma:presence", onPresence);
    return () => window.removeEventListener("ligma:presence", onPresence);
  }, []);

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
        membersOpen,
        setMembersOpen,
        members,
        setMembers,
        jumpToNode: jumpFn,
        exposeJump,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
