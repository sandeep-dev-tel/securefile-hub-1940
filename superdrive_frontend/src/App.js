import React, { useMemo } from "react";
import "./theme.css";
import "./App.css";
import { AppProvider, useApp } from "./context/AppContext";
import TopNav from "./components/TopNav";
import Sidebar from "./components/Sidebar";
import Breadcrumbs from "./components/Breadcrumbs";
import FileList from "./components/FileList";
import LoginPage from "./pages/LoginPage";
import ToastHost from "./components/ToastHost";

// PUBLIC_INTERFACE
function Main() {
  /** Main authenticated layout or login page. */
  const { state } = useApp();

  if (!state.user) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell">
      <TopNav />
      <div className="layout">
        <Sidebar />
        <main className="content">
          <Breadcrumbs />
          <FileList />
        </main>
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
export default function App() {
  /** App root with provider. */
  // Create an event bus once to share with context and UI
  const bus = useMemo(() => new EventTarget(), []);
  return (
    <AppProvider bus={bus}>
      <Main />
      <ToastHost bus={bus} />
    </AppProvider>
  );
}
