import { Fieldset } from '@react95/core'
import type { ReactNode } from 'react'

type Win95StatusGroupProps = {
  legend?: string
  title?: string | null
  children?: ReactNode
}

export function Win95StatusGroup({
  legend = 'Status',
  title,
  children,
}: Win95StatusGroupProps) {
  return (
    <Fieldset
      legend={legend}
      p="$2"
      style={{ marginTop: 'auto', width: '100%', boxSizing: 'border-box' }}
    >
      {title ? (
        <strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>
          {title}
        </strong>
      ) : null}
      {children != null ? (
        <div
          className={title ? undefined : 'win95-muted'}
          style={{ margin: 0, fontSize: 13 }}
        >
          {children}
        </div>
      ) : null}
    </Fieldset>
  )
}
