import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Continuous splash screen progress - never stops moving
// Arc: start offset = 70.65 (6% visible), end = 0 (100%)
const ARC_START = 70.65;
let displayProgress = 6;   // What's visually shown - start very small
let targetProgress = 10;   // Initial target - just slightly ahead
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
    // Slower, steadier movement - max speed capped low for smoothness
    const speed = Math.max(0.08, diff * 0.03);
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
// Continuous progression toward ~85% so it never feels like it jumps
setTimeout(() => setSplashProgress(12), 150);
setTimeout(() => setSplashProgress(18), 350);
setTimeout(() => setSplashProgress(25), 600);
setTimeout(() => setSplashProgress(32), 900);
setTimeout(() => setSplashProgress(40), 1200);
setTimeout(() => setSplashProgress(48), 1600);
setTimeout(() => setSplashProgress(55), 2000);
setTimeout(() => setSplashProgress(62), 2500);
setTimeout(() => setSplashProgress(70), 3200);
setTimeout(() => setSplashProgress(78), 4000);
setTimeout(() => setSplashProgress(85), 5000);

// Safety fallback
setTimeout(hideSplash, 10000);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
