import { Button, Frame } from '@react95/core'
import { Win95Dialog } from '#/shared/ui/Win95Dialog'
import { PaymentChangeLogPanel } from '#/features/admin/PaymentChangeLogPanel'

type PaymentChangeLogDialogProps = {
  open: boolean
  onClose: () => void
}

export function PaymentChangeLogDialog({
  open,
  onClose,
}: PaymentChangeLogDialogProps) {
  return (
    <Win95Dialog
      open={open}
      onClose={onClose}
      title="Betalingslogg"
      width="720px"
      minHeight="280px"
    >
      <PaymentChangeLogPanel enabled={open} />
      <Frame display="flex" justifyContent="flex-end" gap="$2">
        <Button onClick={onClose}>Lukk</Button>
      </Frame>
    </Win95Dialog>
  )
}
