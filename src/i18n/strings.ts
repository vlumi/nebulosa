import { storage } from '../shared/storage'

export type Lang = 'en' | 'ja'
export const LANGS: Lang[] = ['en', 'ja']

/**
 * Every visible word, by key, in each language; the layout never changes with the language, only the words.
 * Satellite names, catalog numbers, units and UTC times stay as they are.
 */
export interface Strings {
  subtitle: string
  footer: string
  loading: string
  pickPlace: string
  sheet: { constellation: string; places: string; passes: string }
  close: (sheet: string) => string
  toggles: {
    /** The globe and theme toggles are icons; these name them. */
    globe: string
    theme: string
    reach: string
    reachTitle: (min: number, max: number) => string
    language: string
  }
  toolbar: {
    lists: string
    satellites: string
    places: string
    passes: string
    nonePicked: string
    none: string
    unselect: (name: string) => string
    clearPass: (name: string) => string
  }
  satellites: {
    launched: string
    orbit: string
    altitude: string
    period: string
    eccentricity: string
    elements: string
    revPerDay: string
    family: { 'sun-synchronous': string; 'mid-inclination': string }
    noradTitle: string
    inclinationTitle: string
    details: (name: string) => string
    now: (name: string) => string
    over: string
    height: string
    speed: string
    heading: string
    nextPass: string
    terminator: string
    noPlace: string
    noneListed: (place: string) => string
    overNow: (place: string, until: string) => string
    passIn: (duration: string, at: string, place: string) => string
    crossing: (into: 'day' | 'night', duration: string) => string
    notCrossed: string
    behind: string
    ahead: string
    orbits: string
    elementsFrom: (when: string, age: string) => string
    aged: (age: string) => string
    timeline: string
    passTitle: (start: string, end: string, peakDeg: number) => string
  }
  places: {
    header: string
    lockPins: string
    useLocation: string
    relocate: string
    locating: string
    locationDenied: string
    locationFailed: string
    myLocation: string
    placeName: string
    save: string
    rename: (name: string) => string
    remove: (name: string) => string
    none: string
  }
  passes: {
    header: (place: string) => string
    next: string
    hoursAhead: string
    hours: (h: number) => string
    show: string
    scope: string
    aboveHorizon: string
    inReach: string
    only: (name: string) => string
    none: string
    showTitle: string
    offNadir: (deg: number, inReach: boolean) => string
    goTo: (name: string, at: string) => string
  }
  time: {
    live: string
    pause: string
    play: string
    speed: string
    rate: (rate: number) => string
    timeOfDay: string
    date: string
    now: string
  }
  follow: { follow: (name: string) => string; following: (name: string) => string }
  help: {
    title: string
    stepPanel: string
    probe: string
    movePlace: string
    goToPass: string
    playPause: string
    live: string
    sheets: string
    onlySelected: string
    reach: string
    globe: string
    theme: string
    follow: string
    escape: string
    help: string
  }
  units: {
    underAnHour: string
    hours: (n: number) => string
    days: (n: number) => string
    minutes: (n: number) => string
    seconds: (n: number) => string
    weekdays: string[]
    /** "Sat 5 Sep" or "9月5日 (土)". */
    day: (weekday: string, day: number, month: number) => string
    compass: string[]
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const en: Strings = {
  subtitle: 'Ground tracks of the StriX SAR constellation',
  footer:
    'Unofficial demo, not affiliated with Synspective. Orbital data: CelesTrak. Map: OpenFreeMap, © OpenStreetMap.',
  loading: 'Loading orbital elements…',
  pickPlace: 'Pick a place to see passes over it.',
  sheet: { constellation: 'Constellation', places: 'Places', passes: 'Passes' },
  close: (sheet) => `Close ${sheet.toLowerCase()}`,
  toggles: {
    globe: 'Globe or flat map',
    theme: 'Light or dark',
    reach: 'SAR',
    reachTitle: (min, max) => `SAR reach: ${min}° to ${max}° off nadir`,
    language: 'Language',
  },
  toolbar: {
    lists: 'Lists',
    satellites: 'Satellites',
    places: 'Places',
    passes: 'Passes',
    nonePicked: 'none picked',
    none: 'none',
    unselect: (name) => `Unselect ${name}`,
    clearPass: (name) => `Clear the ${name} pass`,
  },
  satellites: {
    launched: 'Launched',
    orbit: 'Orbit',
    altitude: 'Altitude',
    period: 'Period',
    eccentricity: 'Eccentricity',
    elements: 'Elements',
    revPerDay: 'rev/day',
    family: { 'sun-synchronous': 'sun-synchronous', 'mid-inclination': 'mid-inclination' },
    noradTitle: 'NORAD catalog number',
    inclinationTitle: 'Inclination',
    details: (name) => `${name} details`,
    now: (name) => `${name} now`,
    over: 'Over',
    height: 'Height',
    speed: 'Speed',
    heading: 'Heading',
    nextPass: 'Next pass',
    terminator: 'Terminator',
    noPlace: 'no place selected',
    noneListed: (place) => `none listed over ${place}`,
    overNow: (place, until) => `over ${place} now, until ${until} UTC`,
    passIn: (duration, at, place) => `in ${duration} · ${at} UTC over ${place}`,
    crossing: (into, duration) => `${into} in ${duration}`,
    notCrossed: 'not crossed this orbit',
    behind: 'Track behind',
    ahead: 'Track ahead',
    orbits: 'orbits',
    elementsFrom: (when, age) => `Elements from ${when} UTC · ${age} old`,
    aged: (age) => `${age} old`,
    timeline: 'Time along the track',
    passTitle: (start, end, peakDeg) => `Pass ${start}–${end} UTC, ${peakDeg}° peak`,
  },
  places: {
    header:
      'Double-click the map, or press and hold on a phone, to add a place. Passes are computed for the selected one.',
    lockPins: 'Lock pins',
    useLocation: 'Use my location',
    relocate: 'Update my location',
    locating: 'Locating…',
    locationDenied: 'The browser was not allowed to share the location.',
    locationFailed: 'The location could not be found.',
    myLocation: 'My location',
    placeName: 'Place name',
    save: 'Save',
    rename: (name) => `Rename ${name}`,
    remove: (name) => `Remove ${name}`,
    none: 'No places yet.',
  },
  passes: {
    header: (place) => `Line-of-sight passes over ${place}.`,
    next: 'Next',
    hoursAhead: 'Hours ahead',
    hours: (h) => `${h} h`,
    show: 'Show',
    scope: 'Passes',
    aboveHorizon: 'above horizon',
    inReach: 'in SAR reach',
    only: (name) => `only ${name}`,
    none: 'None.',
    showTitle: 'Show the peak on the map',
    offNadir: (deg, inReach) => `${deg}° off nadir at the peak${inReach ? ', within SAR reach' : ''}`,
    goTo: (name, at) => `Go to ${name} pass at ${at}`,
  },
  time: {
    live: 'Live',
    pause: 'Pause',
    play: 'Play',
    speed: 'Speed',
    rate: (rate) => `${rate}×`,
    timeOfDay: 'Time of day (UTC)',
    date: 'Date (UTC)',
    now: 'now',
  },
  follow: {
    follow: (name) => `Follow ${name}`,
    following: (name) => `Following ${name}; drag the map to let go`,
  },
  help: {
    title: 'Keyboard shortcuts',
    stepPanel: 'step through the open panel',
    probe: 'probe along the selected track (Shift: 5 min)',
    movePlace: 'move the selected place in its list',
    goToPass: 'go to the pass',
    playPause: 'play / pause',
    live: 'live',
    sheets: 'the sheets, in toolbar order',
    onlySelected: 'only the selected satellite’s passes',
    reach: 'SAR reach beside the selected track',
    globe: 'globe / flat map',
    theme: 'light / dark',
    follow: 'follow the selected satellite',
    escape: 'clear the pass, then the place, then the satellite',
    help: 'this help',
  },
  units: {
    underAnHour: 'under an hour',
    hours: (n) => `${n} h`,
    days: (n) => `${n} d`,
    minutes: (n) => `${n} min`,
    seconds: (n) => `${n} s`,
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    day: (weekday, day, month) => `${weekday} ${day} ${MONTHS[month]}`,
    compass: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
  },
}

export const ja: Strings = {
  subtitle: 'StriX SAR衛星群の地上軌跡',
  footer: '非公式のデモで、Synspective社とは無関係です。軌道データ: CelesTrak。地図: OpenFreeMap、© OpenStreetMap。',
  loading: '軌道要素を読み込んでいます…',
  pickPlace: 'パスを見るには地点を選んでください。',
  sheet: { constellation: '衛星群', places: '地点', passes: 'パス' },
  close: (sheet) => `${sheet}を閉じる`,
  toggles: {
    globe: '地球儀と平面地図の切り替え',
    theme: 'ライト / ダーク',
    reach: 'SAR',
    reachTitle: (min, max) => `SAR撮像範囲: オフナディア角${min}°〜${max}°`,
    language: '言語',
  },
  toolbar: {
    lists: '一覧',
    satellites: '衛星',
    places: '地点',
    passes: 'パス',
    nonePicked: '未選択',
    none: 'なし',
    unselect: (name) => `${name}の選択を解除`,
    clearPass: (name) => `${name}のパスを解除`,
  },
  satellites: {
    launched: '打ち上げ',
    orbit: '軌道',
    altitude: '軌道高度',
    period: '周期',
    eccentricity: '離心率',
    elements: '軌道要素',
    revPerDay: '周回/日',
    family: { 'sun-synchronous': '太陽同期', 'mid-inclination': '中傾斜角' },
    noradTitle: 'NORADカタログ番号',
    inclinationTitle: '軌道傾斜角',
    details: (name) => `${name}の詳細`,
    now: (name) => `${name}の現在`,
    over: '直下点',
    height: '高度',
    speed: '速度',
    heading: '進行方向',
    nextPass: '次のパス',
    terminator: '昼夜境界',
    noPlace: '地点が未選択',
    noneListed: (place) => `${place}上空のパスは一覧にありません`,
    overNow: (place, until) => `${place}上空を通過中、${until} UTCまで`,
    passIn: (duration, at, place) => `${duration}後 · ${at} UTC、${place}上空`,
    crossing: (into, duration) => `${duration}後に${into === 'day' ? '昼' : '夜'}へ`,
    notCrossed: 'この周回では境界を越えません',
    behind: '後方の軌跡',
    ahead: '前方の軌跡',
    orbits: '周回',
    elementsFrom: (when, age) => `軌道要素: ${when} UTC · ${age}前`,
    aged: (age) => `${age}前`,
    timeline: '軌跡上の時刻',
    passTitle: (start, end, peakDeg) => `パス ${start}–${end} UTC、最大仰角${peakDeg}°`,
  },
  places: {
    header: '地図をダブルクリック（スマートフォンでは長押し）して地点を追加。パスは選択中の地点について計算されます。',
    lockPins: 'ピンを固定',
    useLocation: '現在地を使う',
    relocate: '現在地を更新',
    locating: '現在地を取得中…',
    locationDenied: '位置情報の利用が許可されていません。',
    locationFailed: '現在地を取得できませんでした。',
    myLocation: '現在地',
    placeName: '地点名',
    save: '保存',
    rename: (name) => `${name}の名前を変更`,
    remove: (name) => `${name}を削除`,
    none: '地点はまだありません。',
  },
  passes: {
    header: (place) => `${place}から地平線上に見える衛星の通過（パス）。`,
    next: '今後',
    hoursAhead: '表示する時間範囲',
    hours: (h) => `${h}時間`,
    show: '表示',
    scope: 'パス',
    aboveHorizon: '地平線上のすべて',
    inReach: 'SAR撮像範囲内',
    only: (name) => `${name}のみ`,
    none: 'ありません。',
    showTitle: 'ピークの位置を地図に表示',
    offNadir: (deg, inReach) => `ピーク時のオフナディア角${deg}°${inReach ? '、SAR撮像範囲内' : ''}`,
    goTo: (name, at) => `${at}の${name}のパスの時刻へ移動`,
  },
  time: {
    live: 'ライブ',
    pause: '一時停止',
    play: '再生',
    speed: '再生速度',
    rate: (rate) => `${rate}×`,
    timeOfDay: '時刻 (UTC)',
    date: '日付 (UTC)',
    now: '現在',
  },
  follow: {
    follow: (name) => `${name}を追跡`,
    following: (name) => `${name}を追跡中。地図をドラッグすると解除`,
  },
  help: {
    title: 'キーボードショートカット',
    stepPanel: '開いているパネル内を移動',
    probe: '選択中の軌跡をたどる (Shift: 5分)',
    movePlace: '選択中の地点を一覧内で移動',
    goToPass: 'パスの時刻へ',
    playPause: '再生 / 一時停止',
    live: 'ライブ',
    sheets: 'パネル（ツールバーの順）',
    onlySelected: '選択中の衛星のパスのみ',
    reach: '選択中の軌跡のSAR撮像範囲',
    globe: '地球儀 / 平面地図',
    theme: 'ライト / ダーク',
    follow: '選択中の衛星を追跡',
    escape: 'パス、地点、衛星の順に解除',
    help: 'このヘルプ',
  },
  units: {
    underAnHour: '1時間未満',
    hours: (n) => `${n}時間`,
    days: (n) => `${n}日`,
    minutes: (n) => `${n}分`,
    seconds: (n) => `${n}秒`,
    weekdays: ['日', '月', '火', '水', '木', '金', '土'],
    day: (weekday, day, month) => `${month + 1}月${day}日 (${weekday})`,
    compass: ['北', '北東', '東', '南東', '南', '南西', '西', '北西'],
  },
}

export const STRINGS: Record<Lang, Strings> = { en, ja }

/** Each language named in itself, for the picker. */
export const LANGUAGE_NAMES: Record<Lang, string> = { en: 'English', ja: '日本語' }

const KEY = 'nebulosa.lang'

/** The stored choice, else the browser's language, else English. */
export function loadLang(store = storage(), browserLanguage = navigator.language): Lang {
  try {
    const raw = store?.getItem(KEY)
    if (raw === 'en' || raw === 'ja') return raw
  } catch {
    // Unreadable storage: fall through to the browser's language.
  }
  return browserLanguage.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}

export function saveLang(lang: Lang, store = storage()): void {
  try {
    store?.setItem(KEY, lang)
  } catch {
    // Storage full or forbidden: the choice lives on for this visit only.
  }
}
