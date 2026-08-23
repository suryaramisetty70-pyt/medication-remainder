import { Suspense, lazy } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";
import { MobileNav } from "./MobileNav";
import { HealthCoach } from "../coach/HealthCoach";
import { NotificationPrompt } from "../notifications/NotificationPrompt";

const AegisScene = lazy(() => import("../three/AegisScene"));

export function AppShell() {
  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <Suspense fallback={null}>
        <AegisScene />
      </Suspense>

      <Sidebar className="hidden lg:flex" />

      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        <TopHeader />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scroll-none">
          <div className="mx-auto max-w-4xl space-y-6">
            <NotificationPrompt />
            <Outlet />
          </div>
        </main>
      </div>

      <MobileNav className="lg:hidden" />
      <HealthCoach />
    </div>
  );
}
