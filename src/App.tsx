import { useEffect, useState } from "react";
import { CommandPalette } from "./app/CommandPalette";
import { useHashRoute } from "./app/router";
import { useSession } from "./app/session";
import { Shell } from "./app/Shell";
import { useTheme } from "./app/theme";
import { WorkspaceProvider } from "./app/workspace";
import { AuthScreen } from "./features/auth/AuthScreen";
import { EditorHost } from "./features/editors/EditorHost";
import { GaragePage } from "./features/garage/GaragePage";
import { HomePage } from "./features/home/HomePage";
import { InsightsPage } from "./features/insights/InsightsPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { TimelinePage } from "./features/timeline/TimelinePage";
import { BrandMark } from "./ui/BrandMark";
import { ToastProvider } from "./ui/Toast";

export function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}

function Root() {
  const session = useSession();
  const { route, navigate } = useHashRoute();
  const { preference, setPreference } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (session.status === "checking" || session.status === "loading") {
    return (
      <main className="boot-screen" aria-busy="true">
        <BrandMark size={56} />
        <p>{session.status === "checking" ? "正在启动…" : "正在载入你的车库…"}</p>
      </main>
    );
  }

  if (session.status === "signed_out" || !session.authUser) {
    return <AuthScreen onAuthenticate={session.authenticate} />;
  }

  return (
    <WorkspaceProvider navigate={navigate} session={session} setTheme={setPreference} theme={preference}>
      <Shell page={route.page} onOpenPalette={() => setPaletteOpen(true)}>
        {route.page === "home" && <HomePage />}
        {route.page === "timeline" && <TimelinePage params={route.params} />}
        {route.page === "insights" && <InsightsPage />}
        {route.page === "garage" && <GaragePage sub={route.sub} />}
        {route.page === "settings" && <SettingsPage sub={route.sub} />}
      </Shell>
      <EditorHost />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </WorkspaceProvider>
  );
}
