import { Frame } from '@react95/core'
import type { ReactNode } from 'react'

type Win95InlineAlertProps = {
  title: string
  children: ReactNode
}

export function Win95InlineAlert({ title, children }: Win95InlineAlertProps) {
  return (
    <Frame boxShadow="$in" bgColor="white" p="$3">
      <strong style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>
        {title}
      </strong>
      <p style={{ margin: 0, fontSize: 13 }}>{children}</p>
    </Frame>
  )
}
