import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { applyLook } from "./themes.js";
import "./themes.css";
import "./styles.css";

// Paint the saved palette before the first render so dark themes never flash light.
try { applyLook(JSON.parse(localStorage.getItem("work-cheer-v1"))?.settings); } catch { applyLook(); }

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
