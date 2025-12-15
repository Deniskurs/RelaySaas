import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Continuous splash screen progress - never stops moving
// Arc: start offset = 56.5 (25% visible), end = 0 (100%)
const ARC_START = 56.5;
let displayProgress = 25;  // What's visually shown
let targetProgress = 40;   // What we're animating toward
let animationFrame = null;
let splashHidden = false;

function updateArc(progress) {
  const arc = document.getElementById("splash-arc");
  if (arc) {
    const offset = ARC_START - (ARC_START * (progress / 100));
    arc.style.strokeDashoffset = offset;
  }
}

// Continuous animation loop - always moving toward target
function animateProgress() {
  if (splashHidden) return;

  // Calculate how far we are from target
  const diff = targetProgress - displayProgress;

  if (diff > 0.1) {
    // Move faster when far from target, slower when close
    // This creates smooth deceleration as it approaches target
    const speed = Math.max(0.15, diff * 0.08);
    displayProgress += speed;
    updateArc(displayProgress);
  }

  // Keep animating - never stop until hidden
  animationFrame = requestAnimationFrame(animateProgress);
}

// Set a new target - animation will smoothly catch up
function setSplashProgress(percent) {
  if (percent > targetProgress) {
    targetProgress = Math.min(percent, 95); // Cap at 95% until complete
  }
}

function hideSplash() {
  if (splashHidden) return;
  splashHidden = true;

  // Cancel the continuous animation
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }

  // Quickly complete to 100%
  targetProgress = 100;
  const completeAnimation = () => {
    const diff = 100 - displayProgress;
    if (diff > 0.5) {
      displayProgress += diff * 0.2;
      updateArc(displayProgress);
      requestAnimationFrame(completeAnimation);
    } else {
      displayProgress = 100;
      updateArc(100);

      // Fade out splash
      const splash = document.getElementById("splash");
      if (splash) {
        setTimeout(() => {
          splash.style.opacity = "0";
          setTimeout(() => splash.remove(), 400);
        }, 150);
      }
    }
  };
  completeAnimation();
}

// Expose globally
window.__setSplashProgress = setSplashProgress;
window.__hideSplash = hideSplash;

// Start continuous animation immediately
animateProgress();

// Gradually increase target as app loads
// These act as minimum progress gates - actual progress may be faster
setTimeout(() => setSplashProgress(50), 500);
setTimeout(() => setSplashProgress(60), 1500);
setTimeout(() => setSplashProgress(70), 3000);

// Safety fallback
setTimeout(hideSplash, 10000);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
