export type Difficulty = 'beginner' | 'intermediate' | 'expert'

export type GameStatus = 'ready' | 'playing' | 'won' | 'lost'

export type Cell = {
  mine: boolean
  revealed: boolean
  flagged: boolean
  adjacent: number
}

export type BoardConfig = {
  rows: number
  cols: number
  mines: number
}

export const DIFFICULTIES: Record<Difficulty, BoardConfig> = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
}

export function createEmptyBoard(config: BoardConfig): Cell[][] {
  return Array.from({ length: config.rows }, () =>
    Array.from({ length: config.cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    })),
  )
}

function inBounds(board: Cell[][], row: number, col: number) {
  return row >= 0 && row < board.length && col >= 0 && col < board[0].length
}

export function neighbors(row: number, col: number): Array<[number, number]> {
  const result: Array<[number, number]> = []
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue
      result.push([row + dr, col + dc])
    }
  }
  return result
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((cell) => ({ ...cell })))
}

/** Place mines after the first click so that cell is never a mine. */
export function placeMines(
  board: Cell[][],
  config: BoardConfig,
  safeRow: number,
  safeCol: number,
): Cell[][] {
  const next = cloneBoard(board)
  const forbidden = new Set<string>()
  forbidden.add(`${safeRow},${safeCol}`)
  for (const [nr, nc] of neighbors(safeRow, safeCol)) {
    if (inBounds(next, nr, nc)) {
      forbidden.add(`${nr},${nc}`)
    }
  }

  const candidates: Array<[number, number]> = []
  for (let r = 0; r < config.rows; r += 1) {
    for (let c = 0; c < config.cols; c += 1) {
      if (!forbidden.has(`${r},${c}`)) {
        candidates.push([r, c])
      }
    }
  }

  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = candidates[i]
    candidates[i] = candidates[j]
    candidates[j] = tmp
  }

  const mineCount = Math.min(config.mines, candidates.length)
  for (let i = 0; i < mineCount; i += 1) {
    const [r, c] = candidates[i]
    next[r][c].mine = true
  }

  for (let r = 0; r < config.rows; r += 1) {
    for (let c = 0; c < config.cols; c += 1) {
      if (next[r][c].mine) {
        next[r][c].adjacent = 0
        continue
      }
      let count = 0
      for (const [nr, nc] of neighbors(r, c)) {
        if (inBounds(next, nr, nc) && next[nr][nc].mine) {
          count += 1
        }
      }
      next[r][c].adjacent = count
    }
  }

  return next
}

function floodReveal(board: Cell[][], row: number, col: number) {
  const stack: Array<[number, number]> = [[row, col]]
  while (stack.length > 0) {
    const [r, c] = stack.pop()!
    if (!inBounds(board, r, c)) continue
    const cell = board[r][c]
    if (cell.revealed || cell.flagged) continue
    cell.revealed = true
    if (cell.mine || cell.adjacent !== 0) continue
    for (const [nr, nc] of neighbors(r, c)) {
      stack.push([nr, nc])
    }
  }
}

export function countFlags(board: Cell[][]): number {
  let n = 0
  for (const row of board) {
    for (const cell of row) {
      if (cell.flagged) n += 1
    }
  }
  return n
}

export function checkWin(board: Cell[][]): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (!cell.mine && !cell.revealed) return false
    }
  }
  return true
}

export function revealAllMines(board: Cell[][]): Cell[][] {
  const next = cloneBoard(board)
  for (const row of next) {
    for (const cell of row) {
      if (cell.mine) cell.revealed = true
    }
  }
  return next
}

export function revealCell(
  board: Cell[][],
  row: number,
  col: number,
): { board: Cell[][]; hitMine: boolean } {
  const next = cloneBoard(board)
  if (!inBounds(next, row, col)) {
    return { board: next, hitMine: false }
  }
  const cell = next[row][col]
  if (cell.revealed || cell.flagged) {
    return { board: next, hitMine: false }
  }
  if (cell.mine) {
    cell.revealed = true
    return { board: revealAllMines(next), hitMine: true }
  }
  floodReveal(next, row, col)
  return { board: next, hitMine: false }
}

export function toggleFlag(board: Cell[][], row: number, col: number): Cell[][] {
  const next = cloneBoard(board)
  if (!inBounds(next, row, col)) return next
  const cell = next[row][col]
  if (cell.revealed) return next
  cell.flagged = !cell.flagged
  return next
}

/** Chord: if adjacent flags match adjacent count, reveal unflagged neighbors. */
export function chordReveal(
  board: Cell[][],
  row: number,
  col: number,
): { board: Cell[][]; hitMine: boolean } {
  const next = cloneBoard(board)
  if (!inBounds(next, row, col)) {
    return { board: next, hitMine: false }
  }
  const cell = next[row][col]
  if (!cell.revealed || cell.adjacent === 0) {
    return { board: next, hitMine: false }
  }

  let flags = 0
  for (const [nr, nc] of neighbors(row, col)) {
    if (inBounds(next, nr, nc) && next[nr][nc].flagged) {
      flags += 1
    }
  }
  if (flags !== cell.adjacent) {
    return { board: next, hitMine: false }
  }

  let hitMine = false
  for (const [nr, nc] of neighbors(row, col)) {
    if (!inBounds(next, nr, nc)) continue
    const neighbor = next[nr][nc]
    if (neighbor.flagged || neighbor.revealed) continue
    if (neighbor.mine) {
      neighbor.revealed = true
      hitMine = true
    } else {
      floodReveal(next, nr, nc)
    }
  }

  if (hitMine) {
    return { board: revealAllMines(next), hitMine: true }
  }
  return { board: next, hitMine: false }
}
