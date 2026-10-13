export type Node = 'start' | 'pr' | 'merge'
export type Ticket = { key: string; summary: string; status: string; cloudId: string }
export type TodoItem = { key: string; summary: string; status: string }
export type Todos = { items: TodoItem[]; error: string | null; isLoading: boolean; isLoaded: boolean }

declare module 'claude-code' {
  interface PluginState {
    'branch8-jira-mod': {
      ticket: Ticket | null
      asked: string[]
      refreshedAt: number
      todos: Todos
      todoOpen: boolean
    }
  }
}
