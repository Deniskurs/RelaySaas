import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Hide splash screen when React is ready
function hideSplash() {
  const splash = document.getElementById("splash");
  if (splash) {
    splash.style.opacity = "0";
    setTimeout(() => splash.remove(), 400);
  }
}

// Expose globally so pages can call it when truly ready
window.__hideSplash = hideSplash;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
