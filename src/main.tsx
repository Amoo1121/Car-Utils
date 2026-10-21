import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyTheme, readThemePreference } from "./app/theme";
import "./styles/index.css";

// Apply the theme before first paint to avoid a light flash in dark mode.
applyTheme(readThemePreference());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" }).catch(() => {
      // PWA support is best-effort; the app still works as a normal web page.
    });
  });
}
