import React, { createContext, useState, useCallback, useEffect } from "react";
import {
  getAccessToken,
  hasAuthHint,
  refreshAccessToken,
  setAccessToken,
} from "../net/api";

export const AppContext = createContext({
  token: null,
  setToken: () => {},
  currentWorkspace: null,
  setCurrentWorkspace: () => {},
  connectionStatus: "disconnected",
  setConnectionStatus: () => {},
  taskPanelOpen: false,
  setTaskPanelOpen: () => {},
  membersOpen: false,
  setMembersOpen: () => {},
  members: [],
  setMembers: () => {},
  timeTravelOpen: false,
  setTimeTravelOpen: () => {},
  jumpToNode: null,
  exposeJump: () => {},
});

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => {
    const storedToken = window.sessionStorage.getItem("ligma:token");

    if (storedToken) {
      setAccessToken(storedToken);
      return storedToken;
    }

    const apiToken = getAccessToken();
    return apiToken || null;
  });
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [timeTravelOpen, setTimeTravelOpen] = useState(false);

  // jumpToNode function will be set by CanvasView
  const [jumpFn, setJumpFn] = useState(null);
  const exposeJump = useCallback((fn) => setJumpFn(() => fn), []);

  useEffect(() => {
    if (token) {
      window.sessionStorage.setItem("ligma:token", token);
      setAccessToken(token);
    } else {
      window.sessionStorage.removeItem("ligma:token");
      setAccessToken(null);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    if (token || !hasAuthHint()) {
      return () => {
        cancelled = true;
      };
    }

    refreshAccessToken()
      .then((payload) => {
        if (cancelled || !payload?.accessToken) return;
        setToken(payload.accessToken);
      })
      .catch(() => {
        // No active session in this tab yet.
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

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
        timeTravelOpen,
        setTimeTravelOpen,
        jumpToNode: jumpFn,
        exposeJump,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
