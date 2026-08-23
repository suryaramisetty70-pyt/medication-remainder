export type PermissionState = "granted" | "denied" | "prompt" | "unsupported";

export interface NotificationSchedule {
  id: number;
  medicationId: string;
  hour: number;
  minute: number;
  exact: boolean;
}
