import React from "react";
import "./theme.css";
import "./App.css";
import { AppProvider, useApp } from "./context/AppContext";
import TopNav from "./components/TopNav";
import Sidebar from "./components/Sidebar";
import Breadcrumbs from "./components/Breadcrumbs";
import FileList from "./components/FileList";
import LoginPage from "./pages/LoginPage";

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
  return (
    <AppProvider>
      <Main />
    </AppProvider>
  );
}
