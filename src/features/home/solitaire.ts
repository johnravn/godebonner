export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13
export type DrawMode = 1 | 3

export type Card = {
  id: string
  suit: Suit
  rank: Rank
  faceUp: boolean
}

export type Selection =
  | { type: 'waste' }
  | { type: 'foundation'; index: number }
  | { type: 'tableau'; pile: number; cardIndex: number }

export type GameState = {
  stock: Card[]
  waste: Card[]
  foundations: [Card[], Card[], Card[], Card[]]
  tableau: [Card[], Card[], Card[], Card[], Card[], Card[], Card[]]
  drawMode: DrawMode
  won: boolean
}

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']

export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

export const RANK_LABEL: Record<Rank, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
}

export function isRed(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds'
}

function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank: rank as Rank,
        faceUp: false,
      })
    }
  }
  return deck
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = next[i]
    next[i] = next[j]
    next[j] = tmp
  }
  return next
}

function emptyFoundations(): GameState['foundations'] {
  return [[], [], [], []]
}

function emptyTableau(): GameState['tableau'] {
  return [[], [], [], [], [], [], []]
}

export function newGame(drawMode: DrawMode = 3): GameState {
  const deck = shuffle(createDeck())
  const tableau = emptyTableau()
  let i = 0
  for (let pile = 0; pile < 7; pile += 1) {
    for (let n = 0; n <= pile; n += 1) {
      const card = deck[i]
      i += 1
      card.faceUp = n === pile
      tableau[pile].push(card)
    }
  }
  const stock = deck.slice(i).map((card) => ({ ...card, faceUp: false }))

  return {
    stock,
    waste: [],
    foundations: emptyFoundations(),
    tableau,
    drawMode,
    won: false,
  }
}

function cloneState(state: GameState): GameState {
  return {
    stock: state.stock.map((c) => ({ ...c })),
    waste: state.waste.map((c) => ({ ...c })),
    foundations: state.foundations.map((pile) =>
      pile.map((c) => ({ ...c })),
    ) as GameState['foundations'],
    tableau: state.tableau.map((pile) =>
      pile.map((c) => ({ ...c })),
    ) as GameState['tableau'],
    drawMode: state.drawMode,
    won: state.won,
  }
}

function checkWon(state: GameState): boolean {
  return state.foundations.every((pile) => pile.length === 13)
}

function flipTop(pile: Card[]) {
  if (pile.length === 0) return
  const top = pile[pile.length - 1]
  if (!top.faceUp) top.faceUp = true
}

export function canStackOnTableau(moving: Card, targetTop: Card | undefined): boolean {
  if (!targetTop) return moving.rank === 13
  return (
    isRed(moving.suit) !== isRed(targetTop.suit) &&
    moving.rank === targetTop.rank - 1
  )
}

export function canStackOnFoundation(
  moving: Card,
  foundation: Card[],
): boolean {
  if (foundation.length === 0) return moving.rank === 1
  const top = foundation[foundation.length - 1]
  return moving.suit === top.suit && moving.rank === top.rank + 1
}

function isValidRun(cards: Card[]): boolean {
  if (cards.length === 0) return false
  if (!cards.every((c) => c.faceUp)) return false
  for (let i = 0; i < cards.length - 1; i += 1) {
    const a = cards[i]
    const b = cards[i + 1]
    if (isRed(a.suit) === isRed(b.suit)) return false
    if (a.rank !== b.rank + 1) return false
  }
  return true
}

function takeSelection(
  state: GameState,
  selection: Selection,
): { cards: Card[]; remove: () => void } | null {
  if (selection.type === 'waste') {
    if (state.waste.length === 0) return null
    const card = state.waste[state.waste.length - 1]
    return {
      cards: [card],
      remove: () => {
        state.waste.pop()
      },
    }
  }
  if (selection.type === 'foundation') {
    const pile = state.foundations[selection.index]
    if (pile.length === 0) return null
    const card = pile[pile.length - 1]
    return {
      cards: [card],
      remove: () => {
        pile.pop()
      },
    }
  }
  const pile = state.tableau[selection.pile]
  if (selection.cardIndex < 0 || selection.cardIndex >= pile.length) return null
  const cards = pile.slice(selection.cardIndex)
  if (!isValidRun(cards)) return null
  return {
    cards,
    remove: () => {
      pile.splice(selection.cardIndex)
      flipTop(pile)
    },
  }
}

export function drawFromStock(state: GameState): GameState {
  if (state.won) return state
  const next = cloneState(state)

  if (next.stock.length === 0) {
    if (next.waste.length === 0) return state
    next.stock = next.waste
      .slice()
      .reverse()
      .map((card) => ({ ...card, faceUp: false }))
    next.waste = []
    return next
  }

  const count = Math.min(next.drawMode, next.stock.length)
  for (let i = 0; i < count; i += 1) {
    const card = next.stock.pop()
    if (!card) break
    card.faceUp = true
    next.waste.push(card)
  }
  return next
}

export function tryMove(
  state: GameState,
  selection: Selection,
  target:
    | { type: 'foundation'; index: number }
    | { type: 'tableau'; pile: number },
): GameState | null {
  if (state.won) return null
  const next = cloneState(state)
  const taken = takeSelection(next, selection)
  if (!taken) return null

  if (target.type === 'foundation') {
    if (taken.cards.length !== 1) return null
    const foundation = next.foundations[target.index]
    if (!canStackOnFoundation(taken.cards[0], foundation)) return null
    taken.remove()
    foundation.push({ ...taken.cards[0], faceUp: true })
  } else {
    const pile = next.tableau[target.pile]
    const top = pile.length > 0 ? pile[pile.length - 1] : undefined
    if (!canStackOnTableau(taken.cards[0], top)) return null
    taken.remove()
    for (const card of taken.cards) {
      pile.push({ ...card, faceUp: true })
    }
  }

  next.won = checkWon(next)
  return next
}

/** Auto-move selected/top card onto first legal foundation. */
export function tryAutoFoundation(
  state: GameState,
  selection: Selection,
): GameState | null {
  if (state.won) return null
  const taken = takeSelection(cloneState(state), selection)
  if (!taken || taken.cards.length !== 1) return null

  for (let i = 0; i < 4; i += 1) {
    const moved = tryMove(state, selection, { type: 'foundation', index: i })
    if (moved) return moved
  }
  return null
}

export function setDrawMode(state: GameState, drawMode: DrawMode): GameState {
  return newGame(drawMode)
}

export function selectionsEqual(a: Selection | null, b: Selection | null): boolean {
  if (a === null || b === null) return a === b
  if (a.type !== b.type) return false
  if (a.type === 'waste') return true
  if (a.type === 'foundation' && b.type === 'foundation') {
    return a.index === b.index
  }
  if (a.type === 'tableau' && b.type === 'tableau') {
    return a.pile === b.pile && a.cardIndex === b.cardIndex
  }
  return false
}
