import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Hide splash screen when React is ready
let splashHidden = false;
function hideSplash() {
  if (splashHidden) return;
  splashHidden = true;
  const splash = document.getElementById("splash");
  if (splash) {
    splash.style.opacity = "0";
    setTimeout(() => splash.remove(), 400);
  }
}

// Expose globally so pages can call it when truly ready
window.__hideSplash = hideSplash;

// Safety fallback - hide after 3 seconds max
setTimeout(hideSplash, 3000);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
