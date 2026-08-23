import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { MedicationProvider } from "./hooks/useMedications";
import { Toaster } from "sonner";

// Page level bundles are lazily loaded
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Today = lazy(() => import("./pages/Today"));
const Medications = lazy(() => import("./pages/Medications"));
const Adherence = lazy(() => import("./pages/Adherence"));
const Scanner = lazy(() => import("./pages/Scanner"));
const Settings = lazy(() => import("./pages/Settings"));

export default function App() {
  return (
    <BrowserRouter>
      <MedicationProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/today" element={<Today />} />
              <Route path="/medications" element={<Medications />} />
              <Route path="/adherence" element={<Adherence />} />
              <Route path="/scanner" element={<Scanner />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </Suspense>
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "rgb(13 13 16 / 0.85)",
              border: "1px solid rgb(255 255 255 / 0.11)",
              backdropFilter: "blur(24px)",
              color: "#f4f4f5",
            },
          }}
        />
      </MedicationProvider>
    </BrowserRouter>
  );
}
