import { Button } from '@react95/core'
import { Win95Dialog } from '#/shared/ui/Win95Dialog'
import { usePwa } from '#/shared/pwa/PwaProvider'

export function PwaInstallDialog() {
  const {
    softInstallOpen,
    installSurface,
    closeSoftInstall,
    dismissInstallForever,
    dismissInstallLater,
    promptInstall,
  } = usePwa()

  const isIos =
    installSurface === 'ios-instructions' ||
    (typeof navigator !== 'undefined' &&
      /iPad|iPhone|iPod/i.test(navigator.userAgent))
  const canPrompt = installSurface === 'chromium-prompt'

  return (
    <Win95Dialog
      open={softInstallOpen}
      onClose={dismissInstallLater}
      title="Installer Godebonner"
      width="380px"
    >
      {isIos ? (
        <p style={{ margin: 0, fontSize: 13 }}>
          På iPhone/iPad: trykk <strong>Del</strong> i Safari, deretter{' '}
          <strong>Legg til på Hjem-skjerm</strong>.
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 13 }}>
          Installer Godebonner på hjemskjermen for raskere tilgang — nesten som
          en vanlig app.
        </p>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 12,
        }}
      >
        {canPrompt ? (
          <Button
            onClick={() => {
              void promptInstall()
            }}
          >
            Installer
          </Button>
        ) : null}
        <Button onClick={() => dismissInstallLater()}>Ikke nå</Button>
        <Button onClick={() => dismissInstallForever()}>Aldri</Button>
        {!canPrompt && !isIos ? (
          <Button onClick={() => closeSoftInstall()}>Lukk</Button>
        ) : null}
      </div>
    </Win95Dialog>
  )
}
