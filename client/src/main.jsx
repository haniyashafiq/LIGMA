import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProvider } from "./utils/AppContext";
import "./styles/index.css";
import "./styles/auth.css";
import "./styles/app.css";
import "tldraw/tldraw.css";

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);
