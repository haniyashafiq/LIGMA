import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/index.css";
import "./styles/auth.css";
import "./styles/app.css";
import "tldraw/tldraw.css";

const rootElement = document.querySelector("#app");

if (!rootElement) {
  throw new Error("Missing #app root element");
}

createRoot(rootElement).render(
  React.createElement(React.StrictMode, null, React.createElement(App)),
);
