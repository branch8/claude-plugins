export type Node = 'start' | 'pr' | 'merge'
export type Ticket = { key: string; summary: string; status: string; cloudId: string }
export type TodoItem = { key: string; summary: string; status: string; type?: string }
export type Transition = { id: string; to: string; isDone: boolean; hasScreen: boolean }
export type Todos = {
  items: TodoItem[]
  error: string | null
  isLoading: boolean
  isLoaded: boolean
  // The search's token for the next page; null when everything is loaded.
  next: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'branch8-jira-mod': {
      ticket: Ticket | null
      asked: string[]
      // The ticket whose unknown status was asked of Jira once (never polled).
      statusAskedFor: string | null
      todos: Todos
      todoOpen: boolean
      todoFolded: string[]
      langPref: 'zh-TW' | 'zh-CN' | 'en' | 'auto'
      lang: 'zh-TW' | 'zh-CN' | 'en'
      statusFolded: string[]
      scopePref: 'auto' | 'folder' | 'all'
      // noJira: the folder's record says it uses no Jira (not merely unmapped).
      // dir: the folder's name - in a git worktree the main repo's, with the
      // worktree's own name in `worktree` (it is often a ticket key).
      folder: { dir: string; worktree?: string; project: string | null; name: string; noJira?: boolean }
      // The row menu under one ticket; status while its status popup is open:
      // the moves Jira offers (loading until they come), and the one picked to confirm.
      menu: {
        item: TodoItem
        other: boolean
        dir: string
        status?: { isLoading: boolean; list: Transition[]; pick: Transition | null } | null
      } | null
      focusedKey: string | null
      // The pane element the focus ring is on, any kind (the arrows step from it).
      ring: string | null
      // The settings popup: null when closed.
      settings: string | null
      autoOpen: boolean
      // The pane's account block: the Claude login, and the Jira user once the
      // Atlassian MCP answers (checked: asked already, whatever came back;
      // out: still none after the last start-up retry). GitHub (gh) and Devin
      // sign-ins: null while checking; GitHub `skip` outside a git folder.
      account: {
        claude: { email: string; org: string; plan: string } | null
        jira: { name: string; email: string } | null
        isJiraChecked: boolean
        isJiraOut: boolean
        github: { state: 'in' | 'out' | 'missing' | 'skip'; user: string } | null
        devin: { state: 'in' | 'out' | 'missing' | 'skip'; user: string } | null
      }
      // Only tickets updated within this many days; 0 for any age.
      range: number
      isOrg: boolean
      // This mod's version, from its plugin.json, shown in the pane.
      version: string | null
      // The version on the marketplace's main branch, and whether an update runs.
      latest: { version: string | null; isUpdating: boolean }
    }
  }
}
