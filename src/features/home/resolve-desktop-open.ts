export type PublicWindowId =
  | 'coupons'
  | 'info'
  | 'login'
  | 'meny'
  | 'devtools'
  | 'minesweeper'
  | 'solitaire'
  | 'recycle'

export type AdminWindowId =
  | 'admin-panel'
  | 'admin-register'
  | 'admin-members'
  | 'admin-meny'
  | 'admin-organization'
  | 'admin-papirkurv'
  | 'admin-users'
  | 'admin-status'
  | 'admin-welcome'

export type DesktopWindowId = PublicWindowId | AdminWindowId

const OPEN_ALIAS: Record<string, DesktopWindowId> = {
  coupons: 'coupons',
  info: 'info',
  login: 'login',
  account: 'login',
  meny: 'meny',
  devtools: 'devtools',
  minesweeper: 'minesweeper',
  solitaire: 'solitaire',
  recycle: 'recycle',
  admin: 'admin-panel',
  panel: 'admin-panel',
  'admin-panel': 'admin-panel',
  register: 'admin-register',
  'admin-register': 'admin-register',
  members: 'admin-members',
  'admin-members': 'admin-members',
  'admin-meny': 'admin-meny',
  organization: 'admin-organization',
  org: 'admin-organization',
  'admin-organization': 'admin-organization',
  papirkurv: 'admin-papirkurv',
  'admin-papirkurv': 'admin-papirkurv',
  users: 'admin-users',
  'admin-users': 'admin-users',
  status: 'admin-status',
  'admin-status': 'admin-status',
  welcome: 'admin-welcome',
  'admin-welcome': 'admin-welcome',
}

export function resolveDesktopOpen(open?: string): DesktopWindowId | undefined {
  if (!open) return undefined
  return OPEN_ALIAS[open]
}
