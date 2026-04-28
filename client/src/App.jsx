import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getAccessToken } from './net/api';
import { AuthUI } from './auth/AuthUI.jsx';
import { CanvasWorkspace } from './canvas/CanvasWorkspace.jsx';
import { WorkspaceListPage } from './workspaces/WorkspaceListPage.jsx';

function ProtectedRoute({ children }) {
  if (!getAccessToken()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthUI mode="login" />} />
      <Route path="/register" element={<AuthUI mode="register" />} />
      <Route
        path="/workspaces"
        element={
          <ProtectedRoute>
            <WorkspaceListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace/:id"
        element={
          <ProtectedRoute>
            <CanvasWorkspace />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
