import { Frame } from '@react95/core'
import { HelpBook } from '@react95/icons'

export function InfoWindow() {
  return (
    <>
      <Frame display="flex" alignItems="center" gap="$3">
        <HelpBook width={32} height={32} variant="32x32_4" />
        <div>
          <strong style={{ fontSize: 14 }}>Godebonner kaffebar</strong>
          <p className="win95-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            Velkommen til vår lille Windows&nbsp;95-opplevelse.
          </p>
        </div>
      </Frame>

      <img
        src="/godebonner_sirkel_v3.png"
        alt="Godebonner"
        style={{ width: 96, height: 96, objectFit: 'contain', alignSelf: 'center' }}
      />

      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>
        Slå opp gratiskuponger med telefonnummeret ditt i programmet{' '}
        <strong>Kuponger</strong>. Medlemmer som betaler medlemskap
        får et årlig antall kuponger satt av kaffebaren.
      </p>

      <p className="win95-muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>
        Åpne kupongprogrammet fra Start-menyen, eller bruk Logg inn for
        administrasjon dersom du har tilgang.
      </p>
    </>
  )
}
