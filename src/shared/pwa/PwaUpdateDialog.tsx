import { Win95Dialog } from '#/shared/ui/Win95Dialog'
import { usePwa } from '#/shared/pwa/PwaProvider'

export function PwaUpdateDialog() {
  const { updateAvailable, applyUpdate, dismissUpdate } = usePwa()

  return (
    <Win95Dialog
      open={updateAvailable}
      onClose={dismissUpdate}
      title="Oppdatering"
      width="340px"
      buttons={[
        {
          value: 'Start på nytt',
          onClick: () => applyUpdate(),
        },
        {
          value: 'Senere',
          onClick: () => dismissUpdate(),
        },
      ]}
    >
      <p style={{ margin: 0, fontSize: 13 }}>
        En ny versjon av Godebonner er klar. Start på nytt for å laste
        oppdateringen.
      </p>
    </Win95Dialog>
  )
}
