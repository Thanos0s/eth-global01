export type Role = "public" | "investor" | "operator" | "agent";

export interface AuthContext {
  role: Exclude<Role, "public">;
  address: string;
  sessionId: string;
}
