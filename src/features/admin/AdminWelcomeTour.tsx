import { Button, Checkbox, Frame, Input } from '@react95/core'
import {
  Bulb,
  Computer,
  FileSettings,
  FileText,
  FileTextSettings,
  HelpBook,
  Person116,
  Phone2,
  RecycleEmpty,
  User,
} from '@react95/icons'
import { useState, type ReactNode } from 'react'
import { Win95Monitor } from '#/shared/ui/Win95Monitor'
import { Win95Table } from '#/shared/ui/Win95Table'

type TourTip = {
  title: string
  body: string
  preview: ReactNode
}

function PreviewShell({ children }: { children: ReactNode }) {
  return (
    <div className="win95-welcome-preview" aria-hidden>
      <div className="win95-welcome-preview__scale">{children}</div>
    </div>
  )
}

function PreviewControlPanel() {
  const apps = [
    {
      title: 'Registrer kupong',
      icon: <Phone2 variant="32x32_4" width={32} height={32} />,
    },
    {
      title: 'Medlemmer',
      icon: <Person116 variant="16x16_4" width={32} height={32} />,
    },
    {
      title: 'Rediger meny',
      icon: <FileText variant="32x32_4" width={32} height={32} />,
    },
    {
      title: 'Organisasjon',
      icon: <FileTextSettings variant="32x32_4" width={32} height={32} />,
    },
    {
      title: 'Rediger papirkurv',
      icon: <RecycleEmpty variant="32x32_4" width={32} height={32} />,
    },
    {
      title: 'Brukere',
      icon: <User variant="32x32_4" width={32} height={32} />,
    },
    {
      title: 'Status',
      icon: <FileSettings variant="32x32_4" width={32} height={32} />,
    },
    {
      title: 'Velkomstomvisning',
      icon: <HelpBook variant="32x32_4" width={32} height={32} />,
    },
  ]

  return (
    <PreviewShell>
      <Frame
        className="win95-control-panel"
        bgColor="canvas"
        boxShadow="$in"
        p="$3"
      >
        <div className="win95-control-panel__grid">
          {apps.map((app) => (
            <div key={app.title} className="win95-control-panel__item">
              <span className="win95-control-panel__glyph">{app.icon}</span>
              <span className="win95-control-panel__label">{app.title}</span>
            </div>
          ))}
        </div>
      </Frame>
    </PreviewShell>
  )
}

function PreviewRegisterCoupon() {
  return (
    <PreviewShell>
      <Frame
        display="flex"
        flexDirection="column"
        gap="$2"
        p="$2"
        bgColor="material"
      >
        <Frame display="flex" gap="$2" alignItems="stretch">
          <Input
            disabled
            value=""
            placeholder="Telefon, navn eller e-post…"
            style={{ flex: 1 }}
          />
          <Button>Søk</Button>
        </Frame>
        <Frame
          boxShadow="$in"
          bgColor="material"
          p="$2"
          display="flex"
          flexDirection="column"
          gap="$2"
        >
          <Frame
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
            gap="$2"
          >
            <div>
              <strong style={{ fontSize: 12 }}>Ola Nordmann</strong>
              <p
                className="win95-muted"
                style={{ margin: '2px 0 0', fontSize: 10 }}
              >
                Bekreft med kunden at dette er riktig medlem.
              </p>
            </div>
            <Button style={{ fontSize: 10, padding: '2px 6px' }}>
              Fjern betaling for i år
            </Button>
          </Frame>
          <dl
            className="win95-member-facts"
            style={{ margin: 0, fontSize: 10 }}
          >
            <div>
              <dt>Telefon</dt>
              <dd>412 34 567</dd>
            </div>
            <div>
              <dt>Betalt i år</dt>
              <dd>Ja</dd>
            </div>
          </dl>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 'bold' }}>
            Kuponger (1 ubrukte)
          </p>
          <Frame
            display="flex"
            flexDirection="row"
            gap="$1"
            className="win95-coupon-slots"
          >
            <div
              className="win95-coupon-slot win95-coupon-slot--readonly"
              style={{ minHeight: 56, padding: 6 }}
            >
              <Checkbox checked={false} readOnly tabIndex={-1} />
              <span className="win95-coupon-slot__label">
                <span
                  className="win95-coupon-slot__title"
                  style={{ fontSize: 11 }}
                >
                  Kupong 1
                </span>
                <span className="win95-coupon-slot__meta win95-muted">
                  Ubrukt
                </span>
              </span>
            </div>
            <div
              className="win95-coupon-slot win95-coupon-slot--readonly win95-coupon-slot--used"
              style={{ minHeight: 56, padding: 6 }}
            >
              <Checkbox checked readOnly tabIndex={-1} />
              <span className="win95-coupon-slot__label">
                <span
                  className="win95-coupon-slot__title"
                  style={{ fontSize: 11 }}
                >
                  Kupong 2
                </span>
                <span className="win95-coupon-slot__meta win95-muted">
                  Brukt
                </span>
              </span>
            </div>
          </Frame>
        </Frame>
      </Frame>
    </PreviewShell>
  )
}

function PreviewMembers() {
  return (
    <PreviewShell>
      <Frame
        display="flex"
        flexDirection="column"
        gap="$2"
        p="$2"
        bgColor="material"
      >
        <Frame display="flex" gap="$2">
          <Button>Oppfrisk årskuponger</Button>
          <Button>Legg til medlem</Button>
        </Frame>
        <Win95Table>
          <thead>
            <tr>
              <th>Navn</th>
              <th>Telefon</th>
              <th>Betalt i år</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Nordmann, Ola</td>
              <td>412 34 567</td>
              <td>Ja</td>
            </tr>
            <tr>
              <td>Hansen, Kari</td>
              <td>900 11 223</td>
              <td>Nei</td>
            </tr>
          </tbody>
        </Win95Table>
      </Frame>
    </PreviewShell>
  )
}

function PreviewOrganization() {
  return (
    <PreviewShell>
      <Frame
        display="flex"
        flexDirection="column"
        gap="$2"
        p="$2"
        bgColor="material"
      >
        <Frame
          boxShadow="$out"
          p="$2"
          display="flex"
          flexDirection="column"
          gap="$2"
        >
          <div className="win95-field" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>Visningsnavn</label>
            <Input disabled value="Godebonner" style={{ width: '100%' }} />
          </div>
          <div className="win95-field" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>Kuponger per år</label>
            <Input disabled value="3" style={{ maxWidth: 64 }} />
          </div>
          <Checkbox checked readOnly tabIndex={-1}>
            Vis meny for offentligheten
          </Checkbox>
        </Frame>
      </Frame>
    </PreviewShell>
  )
}

function PreviewMeny() {
  return (
    <PreviewShell>
      <Frame
        display="flex"
        gap="$2"
        p="$2"
        bgColor="material"
        height="100%"
      >
        <Frame
          boxShadow="$in"
          bgColor="canvas"
          p="$2"
          style={{ width: 120 }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
            Menyer
          </div>
          <div
            style={{
              fontSize: 11,
              padding: '2px 4px',
              background: '#000080',
              color: '#fff',
            }}
          >
            Hovedmeny
          </div>
          <div style={{ fontSize: 11, padding: '2px 4px' }}>Lunsj</div>
        </Frame>
        <Frame boxShadow="$in" bgColor="canvas" p="$2" flex="1">
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
            Kaffe
          </div>
          <div style={{ fontSize: 11 }}>Espresso · 35 kr</div>
          <div style={{ fontSize: 11 }}>Cappuccino · 45 kr</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Flat white · utsolgt</div>
        </Frame>
      </Frame>
    </PreviewShell>
  )
}

function PreviewPapirkurv() {
  return (
    <PreviewShell>
      <Frame
        display="flex"
        flexDirection="column"
        gap="$2"
        p="$2"
        bgColor="material"
      >
        <Button style={{ alignSelf: 'flex-start' }}>Legg til element</Button>
        <Win95Table>
          <thead>
            <tr>
              <th>Navn</th>
              <th>Beskrivelse</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <RecycleEmpty variant="16x16_4" width={16} height={16} />
                  Gammel PC
                </span>
              </td>
              <td>Fra bakrommet</td>
            </tr>
            <tr>
              <td>
                <span
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <RecycleEmpty variant="16x16_4" width={16} height={16} />
                  Kaffekopp
                </span>
              </td>
              <td>Sprukket hank</td>
            </tr>
          </tbody>
        </Win95Table>
      </Frame>
    </PreviewShell>
  )
}

function PreviewUsers() {
  return (
    <PreviewShell>
      <Frame
        display="flex"
        flexDirection="column"
        gap="$2"
        p="$2"
        bgColor="material"
      >
        <Win95Table>
          <thead>
            <tr>
              <th>E-post</th>
              <th>Admin</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>admin@godebonner.no</td>
              <td>
                <Checkbox checked disabled />
              </td>
            </tr>
            <tr>
              <td>ansatt@godebonner.no</td>
              <td>
                <Checkbox checked={false} disabled />
              </td>
            </tr>
          </tbody>
        </Win95Table>
      </Frame>
    </PreviewShell>
  )
}

function PreviewStatus() {
  return (
    <PreviewShell>
      <Frame
        display="flex"
        flexDirection="column"
        gap="$2"
        p="$2"
        bgColor="material"
      >
        <strong style={{ fontSize: 12 }}>System status</strong>
        <Button style={{ alignSelf: 'flex-start' }}>Run checks</Button>
        <Frame boxShadow="$in" bgColor="canvas" p="$2">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              marginBottom: 4,
            }}
          >
            <span>Supabase</span>
            <span className="win95-badge win95-badge--pass">Pass</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
            }}
          >
            <span>Auth</span>
            <span className="win95-badge win95-badge--pass">Pass</span>
          </div>
        </Frame>
      </Frame>
    </PreviewShell>
  )
}

function PreviewInstallApp() {
  return (
    <PreviewShell>
      <Frame
        display="flex"
        flexDirection="column"
        justifyContent="flex-end"
        style={{ height: '100%', background: '#008080', padding: 8 }}
      >
        <Frame
          bgColor="material"
          boxShadow="$out"
          p="$2"
          display="flex"
          flexDirection="column"
          gap="$1"
          style={{ alignSelf: 'flex-start', minWidth: 160 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              padding: '2px 4px',
            }}
          >
            <Phone2 variant="16x16_4" width={16} height={16} />
            Kuponger
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              padding: '2px 4px',
            }}
          >
            <Computer variant="16x16_4" width={16} height={16} />
            Administrasjon
          </div>
          <hr
            style={{
              margin: '4px 0',
              border: 'none',
              borderTop: '1px solid #808080',
              borderBottom: '1px solid #fff',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              padding: '2px 4px',
              background: '#000080',
              color: '#fff',
            }}
          >
            <Computer variant="16x16_4" width={16} height={16} />
            Installer app…
          </div>
        </Frame>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'flex-start',
            marginTop: 6,
            background: '#c3c7cb',
            padding: '3px 8px',
            boxShadow:
              'inset 1px 1px 0 #fff, inset -1px -1px 0 #808080, 1px 1px 0 #000',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <Computer variant="16x16_4" width={16} height={16} />
          Start
        </div>
      </Frame>
    </PreviewShell>
  )
}

const TIPS: TourTip[] = [
  {
    title: 'Registrer kupong',
    body: 'Dette er det du bruker mest i kassen. Slå opp et medlem med telefon, navn eller e-post, registrer betaling for i år ved behov, og kryss av at en kupong er brukt.',
    preview: <PreviewRegisterCoupon />,
  },
  {
    title: 'Administrasjon',
    body: 'Administrasjon er oversikten over alle admin-programmene. Klikk et ikon én gang for å åpne det. Registrer kupong åpnes også automatisk når du logger inn som administrator.',
    preview: <PreviewControlPanel />,
  },
  {
    title: 'Medlemmer',
    body: 'Her administrerer du medlemslisten med navn, adresse, e-post og om de har betalt i år. Du kan også oppfriske årskuponger for medlemmer som har betalt.',
    preview: <PreviewMembers />,
  },
  {
    title: 'Organisasjon',
    body: 'Her setter du globale innstillinger som visningsnavn, hvor mange kuponger medlemmer som har betalt i år får, og om menyen skal vises for offentligheten.',
    preview: <PreviewOrganization />,
  },
  {
    title: 'Rediger meny',
    body: 'Her lager du menyer med kategorier og varer, setter priser og utsolgt, og velger hvilken meny som skal være live på nettstedet.',
    preview: <PreviewMeny />,
  },
  {
    title: 'Brukere',
    body: 'Her gir du eller fjerner administratorrettigheter, og kan slette innloggede brukere. Kun administratorer får tilgang til dette området.',
    preview: <PreviewUsers />,
  },
  {
    title: 'Rediger papirkurv',
    body: 'Papirkurven er en leken liste du kan fylle med egne elementer — legg til, rediger eller slett innhold etter behov.',
    preview: <PreviewPapirkurv />,
  },
  {
    title: 'Systemstatus',
    body: 'Kjør helsesjekker for å se om Supabase og andre tjenester svarer som forventet.',
    preview: <PreviewStatus />,
  },
  {
    title: 'Installer app',
    body: 'Du kan installere Godebonner på hjemskjermen for raskere tilgang — nesten som en vanlig app. Velg Start → Installer app… (eller følg dialogen som dukker opp etter noen besøk). På iPhone/iPad: Del i Safari, deretter Legg til på Hjem-skjerm.',
    preview: <PreviewInstallApp />,
  },
]

type AdminWelcomeTourProps = {
  onClose?: () => void
}

export function AdminWelcomeTour({ onClose }: AdminWelcomeTourProps) {
  const [tipIndex, setTipIndex] = useState(0)
  const tip = TIPS[tipIndex]
  const isLastTip = tipIndex === TIPS.length - 1

  return (
    <div className="win95-welcome-content">
      <h2 className="win95-welcome-heading">
        Velkommen til <em>Godebonner</em>
      </h2>

      <div className="win95-welcome-body">
        <Frame className="win95-welcome-tip" boxShadow="$in" p="$3">
          <div className="win95-welcome-tip__header">
            <Bulb width={32} height={32} variant="32x32_4" />
            <strong className="win95-welcome-tip__title">Visste du at...</strong>
          </div>
          <p className="win95-welcome-tip__body">
            <strong>{tip.title}:</strong> {tip.body}
          </p>
          <div className="win95-welcome-monitor-wrap">
            <Win95Monitor
              width={280}
              height={210}
              backgroundStyles={{ background: '#008080' }}
            >
              {tip.preview}
            </Win95Monitor>
          </div>
        </Frame>

        <div className="win95-welcome-sidebar">
          {isLastTip ? (
            <>
              <Button onClick={onClose} style={{ width: '100%' }}>
                Ferdig
              </Button>
              <Button
                onClick={() => setTipIndex(0)}
                style={{ width: '100%', marginTop: 8 }}
              >
                Start på nytt
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setTipIndex((i) => i + 1)}
              style={{ width: '100%' }}
            >
              Neste tip
            </Button>
          )}
          <div className="win95-welcome-sidebar__spacer" />
          <hr className="win95-welcome-sidebar__divider" />
          <p
            className="win95-muted"
            style={{ margin: 0, fontSize: 11, lineHeight: 1.35 }}
          >
            Tip {tipIndex + 1} av {TIPS.length}
          </p>
        </div>
      </div>
    </div>
  )
}
