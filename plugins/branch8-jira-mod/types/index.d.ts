export type Node = 'start' | 'pr' | 'merge'
export type Ticket = { key: string; summary: string; status: string; cloudId: string }
export type TodoItem = { key: string; summary: string; status: string; type?: string }
export type Todos = { items: TodoItem[]; error: string | null; isLoading: boolean; isLoaded: boolean }

declare module 'claude-code' {
  interface PluginState {
    'branch8-jira-mod': {
      ticket: Ticket | null
      asked: string[]
      refreshedAt: number
      todos: Todos
      todoOpen: boolean
      todoFolded: string[]
      langPref: 'zh-TW' | 'zh-CN' | 'en' | 'auto'
      lang: 'zh-TW' | 'zh-CN' | 'en'
      statusFolded: string[]
      scopePref: 'auto' | 'folder' | 'all'
      folder: { dir: string; project: string | null; name: string }
      menu: { item: TodoItem; other: boolean; dir: string } | null
      focusedKey: string | null
      // The pane element the focus ring is on, any kind (the arrows step from it).
      ring: string | null
      // The settings popup: null when closed.
      settings: string | null
      autoOpen: boolean
      isOrg: boolean
    }
  }
}
