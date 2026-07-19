import type { CSSProperties } from 'react'

import bat16 from '@react95/icons/png/Bat_16x16_4.png?url'
import bat32 from '@react95/icons/png/Bat_32x32_4.png?url'
import batExec16 from '@react95/icons/png/BatExec_16x16_4.png?url'
import batExec32 from '@react95/icons/png/BatExec_32x32_4.png?url'
import bookmark32 from '@react95/icons/png/Bookmark_32x32_4.png?url'
import brush32 from '@react95/icons/png/Brush_32x32_4.png?url'
import bulb32 from '@react95/icons/png/Bulb_32x32_4.png?url'
import calculator32 from '@react95/icons/png/Calculator_32x32_4.png?url'
import camera32 from '@react95/icons/png/Camera_32x32_4.png?url'
import cdMusic32 from '@react95/icons/png/CdMusic_32x32_4.png?url'
import computer16 from '@react95/icons/png/Computer_16x16_4.png?url'
import computer32 from '@react95/icons/png/Computer_32x32_4.png?url'
import delete16 from '@react95/icons/png/Delete_16x16_4.png?url'
import fileDelete32 from '@react95/icons/png/FileDelete_32x32_4.png?url'
import fileFind32 from '@react95/icons/png/FileFind_32x32_4.png?url'
import fileFont216 from '@react95/icons/png/FileFont2_16x16_4.png?url'
import filePen16 from '@react95/icons/png/FilePen_16x16_4.png?url'
import filePen32 from '@react95/icons/png/FilePen_32x32_4.png?url'
import fileSettings16 from '@react95/icons/png/FileSettings_16x16_4.png?url'
import fileSettings32 from '@react95/icons/png/FileSettings_32x32_4.png?url'
import fileText16 from '@react95/icons/png/FileText_16x16_4.png?url'
import fileText32 from '@react95/icons/png/FileText_32x32_4.png?url'
import fileTextSettings16 from '@react95/icons/png/FileTextSettings_16x16_4.png?url'
import fileTextSettings32 from '@react95/icons/png/FileTextSettings_32x32_4.png?url'
import folder16 from '@react95/icons/png/Folder_16x16_4.png?url'
import folder32 from '@react95/icons/png/Folder_32x32_4.png?url'
import folderOpen16 from '@react95/icons/png/FolderOpen_16x16_4.png?url'
import helpBook16 from '@react95/icons/png/HelpBook_16x16_4.png?url'
import helpBook32 from '@react95/icons/png/HelpBook_32x32_4.png?url'
import keys32 from '@react95/icons/png/Keys_32x32_4.png?url'
import logo16 from '@react95/icons/png/Logo_16x16_4.png?url'
import logo32 from '@react95/icons/png/Logo_32x32_4.png?url'
import mail32 from '@react95/icons/png/Mail_32x32_4.png?url'
import mediaCd16 from '@react95/icons/png/MediaCd_16x16_4.png?url'
import mediaCd32 from '@react95/icons/png/MediaCd_32x32_4.png?url'
import mplayer11316 from '@react95/icons/png/Mplayer113_16x16_4.png?url'
import mute16 from '@react95/icons/png/Mute_16x16_4.png?url'
import mute32 from '@react95/icons/png/Mute_32x32_4.png?url'
import new1616 from '@react95/icons/png/New16_16x16_4.png?url'
import notepad32 from '@react95/icons/png/Notepad_32x32_4.png?url'
import person11616 from '@react95/icons/png/Person116_16x16_4.png?url'
import phone216 from '@react95/icons/png/Phone2_16x16_4.png?url'
import phone232 from '@react95/icons/png/Phone2_32x32_4.png?url'
import recycleEmpty16 from '@react95/icons/png/RecycleEmpty_16x16_4.png?url'
import recycleEmpty32 from '@react95/icons/png/RecycleEmpty_32x32_4.png?url'
import recycleFile32 from '@react95/icons/png/RecycleFile_32x32_4.png?url'
import recycleFull16 from '@react95/icons/png/RecycleFull_16x16_4.png?url'
import recycleFull32 from '@react95/icons/png/RecycleFull_32x32_4.png?url'
import sol116 from '@react95/icons/png/Sol1_16x16_4.png?url'
import sol132 from '@react95/icons/png/Sol1_32x32_4.png?url'
import user16 from '@react95/icons/png/User_16x16_4.png?url'
import user32 from '@react95/icons/png/User_32x32_4.png?url'
import user116 from '@react95/icons/png/User1_16x16_4.png?url'
import user132 from '@react95/icons/png/User1_32x32_4.png?url'
import user232 from '@react95/icons/png/User2_32x32_4.png?url'
import user332 from '@react95/icons/png/User3_32x32_4.png?url'
import user432 from '@react95/icons/png/User4_32x32_4.png?url'
import user532 from '@react95/icons/png/User5_32x32_4.png?url'
import warning32 from '@react95/icons/png/Warning_32x32_4.png?url'
import winmine116 from '@react95/icons/png/Winmine1_16x16_4.png?url'
import winmine132 from '@react95/icons/png/Winmine1_32x32_4.png?url'
import wordpad32 from '@react95/icons/png/Wordpad_32x32_4.png?url'

type IconProps = {
  width?: number | string
  height?: number | string
  variant?: string
  style?: CSSProperties
  className?: string
}

const iconUrls: Record<string, string> = {
  User2_32x32_4: user232,
  User3_32x32_4: user332,
  User4_32x32_4: user432,
  User5_32x32_4: user532,
  MediaCd_16x16_4: mediaCd16,
  MediaCd_32x32_4: mediaCd32,
  FileText_16x16_4: fileText16,
  FileText_32x32_4: fileText32,
  Bat_16x16_4: bat16,
  Bat_32x32_4: bat32,
  Bulb_32x32_4: bulb32,
  FileFont2_16x16_4: fileFont216,
  FilePen_16x16_4: filePen16,
  FilePen_32x32_4: filePen32,
  FileSettings_16x16_4: fileSettings16,
  FileSettings_32x32_4: fileSettings32,
  FileTextSettings_16x16_4: fileTextSettings16,
  FileTextSettings_32x32_4: fileTextSettings32,
  BatExec_16x16_4: batExec16,
  BatExec_32x32_4: batExec32,
  FolderOpen_16x16_4: folderOpen16,
  Folder_16x16_4: folder16,
  Folder_32x32_4: folder32,
  Mplayer113_16x16_4: mplayer11316,
  Logo_16x16_4: logo16,
  Logo_32x32_4: logo32,
  HelpBook_16x16_4: helpBook16,
  HelpBook_32x32_4: helpBook32,
  Person116_16x16_4: person11616,
  Phone2_16x16_4: phone216,
  Phone2_32x32_4: phone232,
  User_16x16_4: user16,
  User_32x32_4: user32,
  User1_16x16_4: user116,
  User1_32x32_4: user132,
  Keys_32x32_4: keys32,
  Computer_16x16_4: computer16,
  Computer_32x32_4: computer32,
  RecycleEmpty_16x16_4: recycleEmpty16,
  RecycleEmpty_32x32_4: recycleEmpty32,
  RecycleFull_16x16_4: recycleFull16,
  RecycleFull_32x32_4: recycleFull32,
  RecycleFile_32x32_4: recycleFile32,
  Winmine1_16x16_4: winmine116,
  Winmine1_32x32_4: winmine132,
  Sol1_16x16_4: sol116,
  Sol1_32x32_4: sol132,
  Notepad_32x32_4: notepad32,
  Wordpad_32x32_4: wordpad32,
  Calculator_32x32_4: calculator32,
  Camera_32x32_4: camera32,
  Brush_32x32_4: brush32,
  Bookmark_32x32_4: bookmark32,
  CdMusic_32x32_4: cdMusic32,
  Mail_32x32_4: mail32,
  Mute_16x16_4: mute16,
  Mute_32x32_4: mute32,
  New16_16x16_4: new1616,
  Warning_32x32_4: warning32,
  FileFind_32x32_4: fileFind32,
  FileDelete_32x32_4: fileDelete32,
  Delete_16x16_4: delete16,
}

function iconUrl(name: string, variant: string) {
  const key = `${name}_${variant}`
  if (key in iconUrls) {
    return iconUrls[key]
  }
  const fallback16 = `${name}_16x16_4`
  if (fallback16 in iconUrls) {
    return iconUrls[fallback16]
  }
  const fallback32 = `${name}_32x32_4`
  if (fallback32 in iconUrls) {
    return iconUrls[fallback32]
  }
  return ''
}

function makeIcon(name: string) {
  return function Icon({
    width = 16,
    height = 16,
    variant = '16x16_4',
    style,
    className,
  }: IconProps) {
    const src = iconUrl(name, variant)
    if (!src) return null

    return (
      <img
        src={src}
        width={width}
        height={height}
        style={{ imageRendering: 'pixelated', ...style }}
        className={className}
        alt=""
        aria-hidden
        draggable={false}
        suppressHydrationWarning
      />
    )
  }
}

export const User2 = makeIcon('User2')
export const User3 = makeIcon('User3')
export const User4 = makeIcon('User4')
export const User5 = makeIcon('User5')
export const MediaCd = makeIcon('MediaCd')
export const FileText = makeIcon('FileText')
export const Bat = makeIcon('Bat')
export const Bulb = makeIcon('Bulb')
export const FileFont2 = makeIcon('FileFont2')
export const FilePen = makeIcon('FilePen')
export const FileSettings = makeIcon('FileSettings')
export const FileTextSettings = makeIcon('FileTextSettings')
export const BatExec = makeIcon('BatExec')
export const FolderOpen = makeIcon('FolderOpen')
export const Folder = makeIcon('Folder')
export const Mplayer113 = makeIcon('Mplayer113')
export const Logo = makeIcon('Logo')
export const HelpBook = makeIcon('HelpBook')
export const Person116 = makeIcon('Person116')
export const Phone2 = makeIcon('Phone2')
export const User = makeIcon('User')
export const User1 = makeIcon('User1')
export const Keys = makeIcon('Keys')
export const Computer = makeIcon('Computer')
export const RecycleEmpty = makeIcon('RecycleEmpty')
export const RecycleFull = makeIcon('RecycleFull')
export const RecycleFile = makeIcon('RecycleFile')
export const Winmine1 = makeIcon('Winmine1')
export const Sol1 = makeIcon('Sol1')
export const Notepad = makeIcon('Notepad')
export const Wordpad = makeIcon('Wordpad')
export const Calculator = makeIcon('Calculator')
export const Camera = makeIcon('Camera')
export const Brush = makeIcon('Brush')
export const Bookmark = makeIcon('Bookmark')
export const CdMusic = makeIcon('CdMusic')
export const Mail = makeIcon('Mail')
export const Mute = makeIcon('Mute')
export const New16 = makeIcon('New16')
export const Warning = makeIcon('Warning')
export const FileFind = makeIcon('FileFind')
export const FileDelete = makeIcon('FileDelete')
export const Delete = makeIcon('Delete')
