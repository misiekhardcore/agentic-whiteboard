/**
 * Every in-app URL, built in one place.
 *
 * Pages, links, redirects, revalidation and the agent's tools all name a
 * destination through this module, so a route that moves is one edit rather
 * than a search for string fragments. Paths are relative: the app is the only
 * origin it can vouch for, and an absolute URL built from a request header is
 * exactly the kind of thing a proxy can lie about.
 */
export const routes = {
  home: "/",

  signIn: "/sign-in",
  signUp: "/sign-up",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",

  dashboard: "/dashboard",
  dashboardArchive: "/dashboard/archive",
  dashboardShared: "/dashboard/shared",
  dashboardOrganization: "/dashboard/organization",
  dashboardBilling: "/dashboard/billing",
  dashboardSettings: "/dashboard/settings",
  dashboardAiHelper: "/dashboard/ai-helper",

  workspaces: "/workspaces",
  /** The workspace a person opens: `/workspaces/:id`. */
  workspace: (id: string) => `/workspaces/${encodeURIComponent(id)}`,
  /** One workspace's history: `/workspaces/:id/activity`. */
  workspaceActivity: (id: string) => `/workspaces/${encodeURIComponent(id)}/activity`,
  /** The mounted surface at `pathname`, showing one conversation. */
  conversationAt: (pathname: string, id: string) =>
    `${pathname}?conversation=${encodeURIComponent(id)}`,
  /** An organization invitation: `/invite/:id`. */
  invite: (id: string) => `/invite/${encodeURIComponent(id)}`,

  agentPromptsApi: "/api/agent/prompts",
  /** The session's conversations, for the dashboard's history dialog. */
  agentConversationsApi: "/api/agent/conversations",
  /** One conversation as a mounted composer reads it, named by `?conversation=`. */
  agentConversationViewApi: "/api/agent/conversations/view",
  /** A short-lived Realtime token and the channels this session may join. */
  realtimeTokenApi: "/api/realtime/token",
} as const;
