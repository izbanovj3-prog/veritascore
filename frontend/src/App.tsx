import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import AuditLauncher from "./components/AuditLauncher";

// The dashboard (and its Recharts dependency) is split into its own chunk and
// loaded only when an audit is opened, keeping the launcher's LCP path minimal.
const Dashboard = lazy(() => import("./Dashboard"));

function DashboardFallback() {
  return (
    <div className="px-6 py-10 text-[12px]" style={{ color: "var(--muted)" }}>
      Opening audit dashboard
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            <Header />
            <AuditLauncher />
          </>
        }
      />
      <Route
        path="/audit/:id"
        element={
          <Suspense fallback={<DashboardFallback />}>
            <Dashboard />
          </Suspense>
        }
      />
    </Routes>
  );
}
