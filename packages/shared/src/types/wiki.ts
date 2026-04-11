export type WikiType =
  | 'log'
  | 'collection'
  | 'belief'
  | 'decision'
  | 'project'
  | 'objective'
  | 'skill'
  | 'agent'
  | 'voice'
  | 'principles'

export interface DefaultWiki {
  name: string
  slug: string
  type: WikiType
}

export const DEFAULT_WIKIS: DefaultWiki[] = [
  { name: 'Daily Log', slug: 'daily-log', type: 'log' },
  { name: 'Bookmarks', slug: 'bookmarks', type: 'collection' },
  { name: 'Beliefs', slug: 'beliefs', type: 'belief' },
  { name: 'Decisions', slug: 'decisions', type: 'decision' },
  { name: 'Projects', slug: 'projects', type: 'project' },
  { name: 'Objectives', slug: 'objectives', type: 'objective' },
  { name: 'Skills', slug: 'skills', type: 'skill' },
  { name: 'Agents', slug: 'agents', type: 'agent' },
  { name: 'Voice', slug: 'voice', type: 'voice' },
  { name: 'Principles', slug: 'principles', type: 'principles' },
]
