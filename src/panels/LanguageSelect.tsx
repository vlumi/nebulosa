import { LANGS, LANGUAGE_NAMES, type Lang } from '../i18n/strings'
import { useStrings } from '../i18n/useStrings'
import styles from './MapToggle.module.css'

interface Props {
  lang: Lang
  onChange: (lang: Lang) => void
}

/** The languages by their own names, no flags: a language is not a country. */
export function LanguageSelect({ lang, onChange }: Props) {
  const s = useStrings()
  return (
    <select
      className={styles.select}
      aria-label={s.toggles.language}
      title={s.toggles.language}
      value={lang}
      onChange={(e) => onChange(e.target.value as Lang)}
    >
      {LANGS.map((l) => (
        <option key={l} value={l}>
          {LANGUAGE_NAMES[l]}
        </option>
      ))}
    </select>
  )
}
