import { Button, Frame } from '@react95/core'
import { useState } from 'react'
import type { Card, DrawMode, Selection } from '#/features/home/solitaire'
import {
  RANK_LABEL,
  SUIT_SYMBOL,
  drawFromStock,
  isRed,
  newGame,
  selectionsEqual,
  setDrawMode,
  tryAutoFoundation,
  tryMove,
} from '#/features/home/solitaire'

function CardFace({ card, selected }: { card: Card; selected?: boolean }) {
  const red = isRed(card.suit)
  return (
    <div
      className={`solitaire-card solitaire-card--face${red ? ' solitaire-card--red' : ''}${selected ? ' solitaire-card--selected' : ''}`}
    >
      <span className="solitaire-card__rank">{RANK_LABEL[card.rank]}</span>
      <span className="solitaire-card__suit">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  )
}

function CardBack() {
  return <div className="solitaire-card solitaire-card--back" aria-hidden />
}

function EmptySlot({
  label,
  selected,
  onClick,
}: {
  label: string
  selected?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`solitaire-slot${selected ? ' solitaire-slot--selected' : ''}`}
      aria-label={label}
      onClick={onClick}
    />
  )
}

export function SolitaireWindow() {
  const [game, setGame] = useState(() => newGame(3))
  const [selection, setSelection] = useState<Selection | null>(null)

  function clearSelection() {
    setSelection(null)
  }

  function deal(mode: DrawMode = game.drawMode) {
    setGame(setDrawMode(game, mode))
    clearSelection()
  }

  function onStockClick() {
    setGame(drawFromStock(game))
    clearSelection()
  }

  function attemptMove(target: {
    type: 'foundation'
    index: number
  } | {
    type: 'tableau'
    pile: number
  }) {
    if (!selection) return false
    const moved = tryMove(game, selection, target)
    if (!moved) return false
    setGame(moved)
    clearSelection()
    return true
  }

  function selectOrMove(next: Selection) {
    if (selection && selectionsEqual(selection, next)) {
      const auto = tryAutoFoundation(game, selection)
      if (auto) {
        setGame(auto)
        clearSelection()
        return
      }
      clearSelection()
      return
    }

    if (selection) {
      if (next.type === 'foundation') {
        if (attemptMove({ type: 'foundation', index: next.index })) return
      }
      if (next.type === 'tableau') {
        if (attemptMove({ type: 'tableau', pile: next.pile })) return
      }
    }

    setSelection(next)
  }

  function onEmptyFoundation(index: number) {
    if (selection) {
      if (attemptMove({ type: 'foundation', index })) return
    }
    clearSelection()
  }

  function onEmptyTableau(pile: number) {
    if (selection) {
      if (attemptMove({ type: 'tableau', pile })) return
    }
    clearSelection()
  }

  const wasteVisibleCount = Math.min(game.drawMode, game.waste.length)
  const wasteVisible =
    wasteVisibleCount > 0 ? game.waste.slice(-wasteVisibleCount) : []
  const wasteFan = game.drawMode === 3

  return (
    <Frame display="flex" flexDirection="column" gap="$2" className="solitaire">
      <Frame display="flex" gap="$1" flexWrap="wrap" alignItems="center">
        <Button
          onClick={() => deal()}
          style={{ fontSize: 12, minHeight: 32, paddingInline: 8 }}
        >
          Nytt spill
        </Button>
        <Button
          onClick={() => deal(1)}
          style={{
            fontSize: 12,
            minHeight: 32,
            paddingInline: 8,
            fontWeight: game.drawMode === 1 ? 'bold' : 'normal',
          }}
        >
          Trekk 1
        </Button>
        <Button
          onClick={() => deal(3)}
          style={{
            fontSize: 12,
            minHeight: 32,
            paddingInline: 8,
            fontWeight: game.drawMode === 3 ? 'bold' : 'normal',
          }}
        >
          Trekk 3
        </Button>
        {game.won ? (
          <span className="solitaire-win" role="status">
            Du vant!
          </span>
        ) : null}
      </Frame>

      <div className="solitaire-felt">
        <div className="solitaire-row solitaire-row--top">
          <div className="solitaire-stock-waste">
            <button
              type="button"
              className="solitaire-stock"
              aria-label={
                game.stock.length > 0
                  ? game.drawMode === 3
                    ? 'Trekk 3 kort'
                    : 'Trekk kort'
                  : 'Bland om stokken'
              }
              onClick={onStockClick}
            >
              {game.stock.length > 0 ? (
                <CardBack />
              ) : (
                <div className="solitaire-slot solitaire-slot--recycle" />
              )}
            </button>
            <div
              className={`solitaire-waste${wasteFan ? ' solitaire-waste--draw3' : ''}`}
            >
              {wasteVisible.length === 0 ? (
                <EmptySlot label="Avfall" onClick={clearSelection} />
              ) : (
                wasteVisible.map((card, index) => {
                  const isTop = index === wasteVisible.length - 1
                  const face = (
                    <CardFace
                      card={card}
                      selected={isTop && selection?.type === 'waste'}
                    />
                  )
                  if (!isTop) {
                    return (
                      <div
                        key={card.id}
                        className="solitaire-waste__card"
                        style={{ left: index * 16 }}
                        aria-hidden
                      >
                        {face}
                      </div>
                    )
                  }
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className="solitaire-card-btn solitaire-waste__card"
                      style={{ left: index * 16 }}
                      aria-label={`${RANK_LABEL[card.rank]} ${SUIT_SYMBOL[card.suit]}`}
                      onClick={() => selectOrMove({ type: 'waste' })}
                      onDoubleClick={() => {
                        const auto = tryAutoFoundation(game, { type: 'waste' })
                        if (auto) {
                          setGame(auto)
                          clearSelection()
                        }
                      }}
                    >
                      {face}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="solitaire-foundations">
            {game.foundations.map((pile, index) => {
              const selected =
                selection?.type === 'foundation' && selection.index === index
              if (pile.length === 0) {
                return (
                  <EmptySlot
                    key={index}
                    label={`Grunnstokk ${index + 1}`}
                    selected={selected}
                    onClick={() => onEmptyFoundation(index)}
                  />
                )
              }
              const top = pile[pile.length - 1]
              return (
                <button
                  key={index}
                  type="button"
                  className="solitaire-card-btn"
                  aria-label={`${RANK_LABEL[top.rank]} ${SUIT_SYMBOL[top.suit]}`}
                  onClick={() =>
                    selectOrMove({ type: 'foundation', index })
                  }
                >
                  <CardFace card={top} selected={selected} />
                </button>
              )
            })}
          </div>
        </div>

        <div className="solitaire-tableau">
          {game.tableau.map((pile, pileIndex) => (
            <div key={pileIndex} className="solitaire-tableau__pile">
              {pile.length === 0 ? (
                <EmptySlot
                  label={`Kolonne ${pileIndex + 1}`}
                  selected={false}
                  onClick={() => onEmptyTableau(pileIndex)}
                />
              ) : (
                pile.map((card, cardIndex) => {
                  const selected =
                    selection?.type === 'tableau' &&
                    selection.pile === pileIndex &&
                    selection.cardIndex === cardIndex
                  const inSelectedRun =
                    selection?.type === 'tableau' &&
                    selection.pile === pileIndex &&
                    cardIndex >= selection.cardIndex

                  if (!card.faceUp) {
                    return (
                      <div
                        key={card.id}
                        className="solitaire-tableau__card"
                        style={{ top: cardIndex * 18 }}
                      >
                        <CardBack />
                      </div>
                    )
                  }

                  return (
                    <button
                      key={card.id}
                      type="button"
                      className="solitaire-card-btn solitaire-tableau__card"
                      style={{ top: cardIndex * 18 }}
                      aria-label={`${RANK_LABEL[card.rank]} ${SUIT_SYMBOL[card.suit]}`}
                      onClick={() =>
                        selectOrMove({
                          type: 'tableau',
                          pile: pileIndex,
                          cardIndex,
                        })
                      }
                      onDoubleClick={() => {
                        if (cardIndex !== pile.length - 1) return
                        const auto = tryAutoFoundation(game, {
                          type: 'tableau',
                          pile: pileIndex,
                          cardIndex,
                        })
                        if (auto) {
                          setGame(auto)
                          clearSelection()
                        }
                      }}
                    >
                      <CardFace
                        card={card}
                        selected={selected || inSelectedRun}
                      />
                    </button>
                  )
                })
              )}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  )
}
