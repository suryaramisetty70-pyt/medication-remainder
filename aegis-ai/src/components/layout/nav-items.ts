import { LayoutDashboard, Calendar, Pill, TrendingUp, ScanFace, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  Icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/", Icon: LayoutDashboard },
  { label: "Today", path: "/today", Icon: Calendar },
  { label: "Medications", path: "/medications", Icon: Pill },
  { label: "Adherence", path: "/adherence", Icon: TrendingUp },
  { label: "Verify Pill", path: "/scanner", Icon: ScanFace },
  { label: "Settings", path: "/settings", Icon: Settings },
];
