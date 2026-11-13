import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { applyLook } from "./themes.js";
import "./themes.css";
import "./styles.css";
import "./styles-more.css";

// The two numeral fonts are under 1 KB each: fetch them up front so 像素 and 液晶 (and their
// miniatures in 设置 → 外观) never show a blank where the figures should be.
try { for (const family of ["WC Pixel", "WC LCD"]) document.fonts.load(`20px "${family}"`, "0"); } catch { /* They still load on first use. */ }

// Paint the saved palette before the first render so dark themes never flash light.
try { applyLook(JSON.parse(localStorage.getItem("work-cheer-v1"))?.settings); } catch { applyLook(); }

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
