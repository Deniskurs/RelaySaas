import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Splash screen progress control
// Arc: start offset = 56.5 (25% visible), end = 0 (100%)
const ARC_START = 56.5;

function setSplashProgress(percent) {
  const arc = document.getElementById("splash-arc");
  if (arc) {
    // Map 0-100% to offset 56.5 -> 0
    const offset = ARC_START - (ARC_START * (percent / 100));
    arc.style.strokeDashoffset = offset;
  }
}

let splashHidden = false;
function hideSplash() {
  if (splashHidden) return;
  splashHidden = true;

  // Complete the arc first
  setSplashProgress(100);

  const splash = document.getElementById("splash");
  if (splash) {
    // Wait for arc to complete, then fade out
    setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          splash.style.opacity = "0";
          setTimeout(() => splash.remove(), 400);
        });
      });
    }, 300);
  }
}

// Expose globally
window.__setSplashProgress = setSplashProgress;
window.__hideSplash = hideSplash;

// Safety fallback - hide after 10 seconds max
setTimeout(hideSplash, 10000);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
