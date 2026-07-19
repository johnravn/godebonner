import { Frame } from '@react95/core'
import { useEffect, useRef, useState } from 'react'
import type {
  BoardConfig,
  Cell,
  Difficulty,
  GameStatus,
} from '#/features/home/minesweeper'
import {
  DIFFICULTIES,
  checkWin,
  chordReveal,
  countFlags,
  createEmptyBoard,
  placeMines,
  revealCell,
  toggleFlag,
} from '#/features/home/minesweeper'
import { Win95Select } from '#/shared/ui/Win95Select'

const DIFFICULTY_OPTIONS = [
  { value: 'beginner', label: 'Nybegynner' },
  { value: 'intermediate', label: 'Middels' },
  { value: 'expert', label: 'Ekspert' },
] as const

function formatCounter(n: number) {
  const clamped = Math.max(-99, Math.min(999, n))
  const abs = Math.abs(clamped).toString().padStart(3, '0')
  return clamped < 0 ? `-${abs.slice(1)}` : abs
}

function cellClass(cell: Cell, status: GameStatus) {
  const classes = ['minesweeper-cell']
  if (!cell.revealed) {
    classes.push('minesweeper-cell--hidden')
    if (cell.flagged) classes.push('minesweeper-cell--flagged')
    return classes.join(' ')
  }
  classes.push('minesweeper-cell--revealed')
  if (cell.mine) {
    classes.push('minesweeper-cell--mine')
    if (status === 'lost') classes.push('minesweeper-cell--mine-hit')
  } else if (cell.adjacent > 0) {
    classes.push(`minesweeper-cell--n${cell.adjacent}`)
  }
  return classes.join(' ')
}

function cellContent(cell: Cell) {
  if (!cell.revealed) {
    return cell.flagged ? '🚩' : ''
  }
  if (cell.mine) return '💣'
  if (cell.adjacent === 0) return ''
  return String(cell.adjacent)
}

function faceForStatus(status: GameStatus, pressed: boolean) {
  if (pressed) return '😮'
  if (status === 'won') return '😎'
  if (status === 'lost') return '😵'
  return '🙂'
}

export function MinesweeperWindow() {
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [config, setConfig] = useState<BoardConfig>(DIFFICULTIES.beginner)
  const [board, setBoard] = useState<Cell[][]>(() =>
    createEmptyBoard(DIFFICULTIES.beginner),
  )
  const [status, setStatus] = useState<GameStatus>('ready')
  const [seconds, setSeconds] = useState(0)
  const [facePressed, setFacePressed] = useState(false)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)

  useEffect(() => {
    if (status !== 'playing') return
    const id = setInterval(() => {
      setSeconds((s) => Math.min(999, s + 1))
    }, 1000)
    return () => clearInterval(id)
  }, [status])

  function reset(nextDifficulty: Difficulty = difficulty) {
    const nextConfig = DIFFICULTIES[nextDifficulty]
    setDifficulty(nextDifficulty)
    setConfig(nextConfig)
    setBoard(createEmptyBoard(nextConfig))
    setStatus('ready')
    setSeconds(0)
  }

  function applyReveal(nextBoard: Cell[][], hitMine: boolean) {
    if (hitMine) {
      setBoard(nextBoard)
      setStatus('lost')
      return
    }
    if (checkWin(nextBoard)) {
      const flagged = nextBoard.map((row) =>
        row.map((cell) => (cell.mine ? { ...cell, flagged: true } : cell)),
      )
      setBoard(flagged)
      setStatus('won')
      return
    }
    setBoard(nextBoard)
  }

  function handleReveal(row: number, col: number) {
    if (status === 'won' || status === 'lost') return
    const cell = board[row][col]
    if (cell.flagged || cell.revealed) return

    let working = board
    if (status === 'ready') {
      working = placeMines(board, config, row, col)
      setStatus('playing')
    }

    const { board: nextBoard, hitMine } = revealCell(working, row, col)
    applyReveal(nextBoard, hitMine)
  }

  function handleFlag(row: number, col: number) {
    if (status === 'won' || status === 'lost') return
    if (board[row][col].revealed) return
    if (status === 'ready') {
      setStatus('playing')
    }
    setBoard(toggleFlag(board, row, col))
  }

  function handleChord(row: number, col: number) {
    if (status !== 'playing') return
    const { board: nextBoard, hitMine } = chordReveal(board, row, col)
    applyReveal(nextBoard, hitMine)
  }

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }

  const minesLeft = config.mines - countFlags(board)

  return (
    <Frame display="flex" flexDirection="column" gap="$2" className="minesweeper">
      <div className="minesweeper-controls">
        <Win95Select
          aria-label="Vanskelighetsgrad"
          value={difficulty}
          options={[...DIFFICULTY_OPTIONS]}
          onChange={(value) => reset(value as Difficulty)}
        />
      </div>

      <div className="minesweeper-hud">
        <div className="minesweeper-counter" aria-label="Miner igjen">
          {formatCounter(minesLeft)}
        </div>
        <button
          type="button"
          className="minesweeper-face"
          aria-label="Ny runde"
          onMouseDown={() => setFacePressed(true)}
          onMouseUp={() => setFacePressed(false)}
          onMouseLeave={() => setFacePressed(false)}
          onClick={() => reset()}
        >
          {faceForStatus(status, facePressed)}
        </button>
        <div className="minesweeper-counter" aria-label="Tid">
          {formatCounter(seconds)}
        </div>
      </div>

      <div
        className="minesweeper-board"
        style={{
          gridTemplateColumns: `repeat(${config.cols}, auto)`,
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {board.map((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              type="button"
              className={cellClass(cell, status)}
              aria-label={`Rute ${r + 1}, ${c + 1}`}
              onClick={(e) => {
                if (longPressFired.current) {
                  longPressFired.current = false
                  return
                }
                if (e.detail === 2 && cell.revealed) {
                  handleChord(r, c)
                  return
                }
                if (cell.revealed && cell.adjacent > 0) {
                  handleChord(r, c)
                  return
                }
                handleReveal(r, c)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                handleFlag(r, c)
              }}
              onPointerDown={() => {
                longPressFired.current = false
                clearLongPress()
                longPressRef.current = setTimeout(() => {
                  longPressFired.current = true
                  handleFlag(r, c)
                }, 450)
              }}
              onPointerUp={clearLongPress}
              onPointerLeave={clearLongPress}
              onPointerCancel={clearLongPress}
            >
              {cellContent(cell)}
            </button>
          )),
        )}
      </div>
    </Frame>
  )
}
