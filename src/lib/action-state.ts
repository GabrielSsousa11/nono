export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string; data?: Record<string, unknown> }
  | { status: "error"; message: string };

export const IDLE: ActionState = { status: "idle" };

export const ok = (message: string, data?: Record<string, unknown>): ActionState => ({
  status: "success",
  message,
  data,
});
export const fail = (message: string): ActionState => ({ status: "error", message });
