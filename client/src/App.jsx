import React, { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthPage } from "./pages/AuthPage";
import { WorkspacesPage } from "./pages/WorkspacesPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { TasksPage } from "./pages/TasksPage";
import ProjectsPage from "./pages/ProjectsPage";
import { getMe } from "./net/api";

export function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    getMe()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null));
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/workspaces" element={<WorkspacesPage />} />
        <Route path="/workspace/:workspaceId/:tab?" element={<WorkspacePage />} />
        <Route path="/tasks" element={<TasksPage user={user} />} />
        <Route path="/projects" element={<ProjectsPage user={user} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
