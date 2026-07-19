import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react'

type Kids = { children?: ReactNode } & Record<string, unknown>

function Frame({ children, as: As, ...rest }: Kids & { as?: string }) {
  const Tag = (As as keyof HTMLElementTagNameMap) || 'div'
  const {
    boxShadow: _b,
    bgColor: _g,
    m: _m,
    p: _p,
    pt: _pt,
    gap: _gap,
    display: _d,
    flexDirection: _f,
    alignItems: _a,
    justifyContent: _j,
    ...dom
  } = rest
  return <Tag {...(dom as object)}>{children}</Tag>
}

export function Button({
  children,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) {
  return (
    <button type={type} {...props}>
      {children}
    </button>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />
}

export function Checkbox({
  checked,
  readOnly,
  ...props
}: {
  checked?: boolean
  readOnly?: boolean
} & Record<string, unknown>) {
  return (
    <input
      type="checkbox"
      checked={Boolean(checked)}
      readOnly={readOnly}
      {...props}
    />
  )
}

export { Frame }
export function ProgressBar({
  percent = 0,
  ...rest
}: Kids & { percent?: number; width?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      {...(rest as object)}
    >
      {percent}%
    </div>
  )
}
export function Tabs({ children, onChange, ...rest }: Kids & { onChange?: (title: string, e: unknown) => void; defaultActiveTab?: string }) {
  return <div {...(rest as object)}>{children}</div>
}
export function Tab({ children, title }: Kids & { title?: string }) {
  return <div data-tab={title}>{children}</div>
}
export function Fieldset({ children, ...rest }: Kids) {
  return <fieldset {...(rest as object)}>{children}</fieldset>
}

function TitleBarRoot({
  children,
  title,
  ...rest
}: Kids & { title?: string; active?: boolean; icon?: ReactNode }) {
  return (
    <div {...(rest as object)}>
      {title ? <span>{title}</span> : null}
      {children}
    </div>
  )
}

function TitleBarOption({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) {
  return (
    <button type="button" {...props}>
      {children}
    </button>
  )
}

export const TitleBar = Object.assign(TitleBarRoot, {
  OptionsBox: ({ children, ...rest }: Kids) => (
    <div {...(rest as object)}>{children}</div>
  ),
  Close: (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <TitleBarOption aria-label="close" {...props}>
      ×
    </TitleBarOption>
  ),
  Help: (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <TitleBarOption aria-label="help" {...props}>
      ?
    </TitleBarOption>
  ),
  Maximize: (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <TitleBarOption aria-label="maximize" {...props}>
      □
    </TitleBarOption>
  ),
  Minimize: (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <TitleBarOption aria-label="minimize" {...props}>
      _
    </TitleBarOption>
  ),
  Restore: (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <TitleBarOption aria-label="restore" {...props}>
      ▢
    </TitleBarOption>
  ),
  Option: TitleBarOption,
})
