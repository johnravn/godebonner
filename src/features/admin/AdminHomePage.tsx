import { Frame } from '@react95/core'

export function AdminHomePage() {
  return (
    <Frame display="flex" flexDirection="column" gap="$3" pt="$3">
      <h2 style={{ margin: 0, fontSize: 16 }}>Administrasjon</h2>
      <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
        Velg en fane ovenfor for å administrere meny, medlemmer, organisasjon,
        papirkurv, brukere eller systemstatus.
      </p>
      <p className="win95-muted" style={{ margin: 0, fontSize: 13 }}>
        Trenger du en gjennomgang? Åpne Velkomstomvisning fra Kontrollpanelet.
      </p>
    </Frame>
  )
}
