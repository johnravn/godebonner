import { describe, expect, it, vi } from 'vitest'
import {
  canStackOnFoundation,
  canStackOnTableau,
  drawFromStock,
  isRed,
  newGame,
  selectionsEqual,
  setDrawMode,
  tryAutoFoundation,
  tryMove,
  type Card,
  type GameState,
} from './solitaire'

function card(
  suit: Card['suit'],
  rank: Card['rank'],
  faceUp = true,
): Card {
  return { id: `${suit}-${rank}`, suit, rank, faceUp }
}

describe('solitaire rules', () => {
  it('classifies red suits', () => {
    expect(isRed('hearts')).toBe(true)
    expect(isRed('diamonds')).toBe(true)
    expect(isRed('clubs')).toBe(false)
  })

  it('deals a full game with draw mode', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const state = newGame(1)
    expect(state.drawMode).toBe(1)
    expect(state.tableau.flat()).toHaveLength(28)
    expect(state.stock.length + state.waste.length).toBe(24)
    expect(state.won).toBe(false)
    vi.restoreAllMocks()
  })

  it('enforces tableau and foundation stacking rules', () => {
    expect(canStackOnTableau(card('hearts', 12), undefined)).toBe(false)
    expect(canStackOnTableau(card('spades', 13), undefined)).toBe(true)
    expect(canStackOnTableau(card('hearts', 11), card('clubs', 12))).toBe(true)
    expect(canStackOnTableau(card('hearts', 11), card('diamonds', 12))).toBe(
      false,
    )

    expect(canStackOnFoundation(card('hearts', 1), [])).toBe(true)
    expect(canStackOnFoundation(card('hearts', 2), [card('hearts', 1)])).toBe(
      true,
    )
    expect(canStackOnFoundation(card('clubs', 2), [card('hearts', 1)])).toBe(
      false,
    )
  })

  it('draws from stock according to draw mode and recycles waste', () => {
    const state: GameState = {
      stock: [card('clubs', 5, false), card('clubs', 6, false)],
      waste: [],
      foundations: [[], [], [], []],
      tableau: [[], [], [], [], [], [], []],
      drawMode: 3,
      won: false,
    }
    const drawn = drawFromStock(state)
    expect(drawn.waste).toHaveLength(2)
    expect(drawn.stock).toHaveLength(0)

    const recycled = drawFromStock(drawn)
    expect(recycled.stock).toHaveLength(2)
    expect(recycled.waste).toHaveLength(0)
  })

  it('moves ace to foundation and can win', () => {
    const ace = card('hearts', 1)
    const state: GameState = {
      stock: [],
      waste: [ace],
      foundations: [[], [], [], []],
      tableau: [[], [], [], [], [], [], []],
      drawMode: 1,
      won: false,
    }
    const moved = tryMove(state, { type: 'waste' }, { type: 'foundation', index: 0 })
    expect(moved?.foundations[0]).toHaveLength(1)

    const almostWon: GameState = {
      ...state,
      waste: [card('spades', 13)],
      foundations: [
        Array.from({ length: 13 }, (_, i) => card('hearts', (i + 1) as Card['rank'])),
        Array.from({ length: 13 }, (_, i) => card('diamonds', (i + 1) as Card['rank'])),
        Array.from({ length: 13 }, (_, i) => card('clubs', (i + 1) as Card['rank'])),
        Array.from({ length: 12 }, (_, i) => card('spades', (i + 1) as Card['rank'])),
      ],
    }
    const won = tryMove(
      almostWon,
      { type: 'waste' },
      { type: 'foundation', index: 3 },
    )
    expect(won?.won).toBe(true)
  })

  it('auto-moves to foundation when legal', () => {
    const state: GameState = {
      stock: [],
      waste: [card('hearts', 1)],
      foundations: [[], [], [], []],
      tableau: [[], [], [], [], [], [], []],
      drawMode: 1,
      won: false,
    }
    const next = tryAutoFoundation(state, { type: 'waste' })
    expect(next?.foundations.some((p) => p.length === 1)).toBe(true)
  })

  it('moves cards on tableau when stacking is legal', () => {
    const king = card('spades', 13)
    const queen = card('hearts', 12)
    const state: GameState = {
      stock: [],
      waste: [queen],
      foundations: [[], [], [], []],
      tableau: [[king], [], [], [], [], [], []],
      drawMode: 1,
      won: false,
    }
    const moved = tryMove(
      state,
      { type: 'waste' },
      { type: 'tableau', pile: 0 },
    )
    expect(moved?.tableau[0]).toHaveLength(2)
    expect(moved?.waste).toHaveLength(0)
  })

  it('rejects illegal tableau moves', () => {
    const state: GameState = {
      stock: [],
      waste: [card('hearts', 5)],
      foundations: [[], [], [], []],
      tableau: [[card('hearts', 6)], [], [], [], [], [], []],
      drawMode: 1,
      won: false,
    }
    expect(
      tryMove(state, { type: 'waste' }, { type: 'tableau', pile: 0 }),
    ).toBeNull()
  })

  it('compares selections and resets draw mode via new game', () => {
    expect(selectionsEqual({ type: 'waste' }, { type: 'waste' })).toBe(true)
    expect(
      selectionsEqual(
        { type: 'tableau', pile: 1, cardIndex: 0 },
        { type: 'tableau', pile: 1, cardIndex: 1 },
      ),
    ).toBe(false)
    const next = setDrawMode(newGame(3), 1)
    expect(next.drawMode).toBe(1)
  })
})
