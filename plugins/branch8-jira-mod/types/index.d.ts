export type Node = 'start' | 'pr' | 'merge'
export type Ticket = { key: string; summary: string; status: string; cloudId: string }

declare module 'claude-code' {
  interface PluginState {
    'branch8-jira-mod': { ticket: Ticket | null; asked: string[]; refreshedAt: number }
  }
}
