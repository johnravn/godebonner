import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  checkWin,
  chordReveal,
  countFlags,
  createEmptyBoard,
  DIFFICULTIES,
  placeMines,
  revealCell,
  toggleFlag,
} from './minesweeper'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('minesweeper', () => {
  it('creates an empty board of the configured size', () => {
    const board = createEmptyBoard(DIFFICULTIES.beginner)
    expect(board).toHaveLength(9)
    expect(board[0]).toHaveLength(9)
    expect(board.flat().every((c) => !c.mine && !c.revealed)).toBe(true)
  })

  it('never places a mine on the first click or its neighbors', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const config = DIFFICULTIES.beginner
    const empty = createEmptyBoard(config)
    const board = placeMines(empty, config, 0, 0)
    expect(board[0][0].mine).toBe(false)
    expect(board[0][1].mine).toBe(false)
    expect(board[1][0].mine).toBe(false)
    expect(board[1][1].mine).toBe(false)
    expect(board.flat().filter((c) => c.mine)).toHaveLength(config.mines)
  })

  it('toggles flags on unrevealed cells only', () => {
    let board = createEmptyBoard({ rows: 2, cols: 2, mines: 0 })
    board = toggleFlag(board, 0, 0)
    expect(board[0][0].flagged).toBe(true)
    expect(countFlags(board)).toBe(1)
    board = toggleFlag(board, 0, 0)
    expect(board[0][0].flagged).toBe(false)

    board[0][1].revealed = true
    board = toggleFlag(board, 0, 1)
    expect(board[0][1].flagged).toBe(false)
  })

  it('reveals a mine and floods empty regions', () => {
    const board = createEmptyBoard({ rows: 3, cols: 3, mines: 1 })
    board[0][0].mine = true
    board[1][1].adjacent = 1

    const hit = revealCell(board, 0, 0)
    expect(hit.hitMine).toBe(true)
    expect(hit.board[0][0].revealed).toBe(true)

    const safe = createEmptyBoard({ rows: 3, cols: 3, mines: 0 })
    const opened = revealCell(safe, 1, 1)
    expect(opened.hitMine).toBe(false)
    expect(opened.board.flat().every((c) => c.revealed)).toBe(true)
  })

  it('detects win when all non-mines are revealed', () => {
    const board = createEmptyBoard({ rows: 2, cols: 2, mines: 1 })
    board[0][0].mine = true
    board[0][1].revealed = true
    board[1][0].revealed = true
    board[1][1].revealed = true
    expect(checkWin(board)).toBe(true)
    board[1][1].revealed = false
    expect(checkWin(board)).toBe(false)
  })

  it('chords when adjacent flags match', () => {
    const board = createEmptyBoard({ rows: 3, cols: 3, mines: 1 })
    board[1][1].revealed = true
    board[1][1].adjacent = 1
    board[0][0].mine = true
    board[0][0].flagged = true
    board[0][1].adjacent = 1
    board[1][0].adjacent = 1

    const result = chordReveal(board, 1, 1)
    expect(result.hitMine).toBe(false)
    expect(result.board[0][1].revealed || result.board[1][0].revealed).toBe(
      true,
    )
  })
})
