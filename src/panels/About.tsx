import { useStrings } from '../i18n/useStrings'
import { COPYRIGHT, DATA_CREDITS, LIBRARIES, MAP_CREDITS, REPO_URL, type Credit } from '../shared/site'
import styles from './About.module.css'

interface Props {
  open: boolean
  onToggle: (open: boolean) => void
}

const Links = ({ credits }: { credits: Credit[] }) => (
  <>
    {credits.map(([name, url], i) => (
      <span key={name}>
        {i > 0 && ', '}
        <a href={url} target="_blank" rel="noopener">
          {name}
        </a>
      </span>
    ))}
  </>
)

/** The corner bottom-right: the credits behind an ⓘ button, on every screen. */
export function About({ open, onToggle }: Props) {
  const s = useStrings()
  return (
    <div className={styles.about}>
      {open && (
        <div className={styles.panel} role="region" aria-label={s.about.title}>
          <p>{s.about.disclaimer}</p>
          <p>
            {s.about.data}: <Links credits={DATA_CREDITS} />. {s.about.map}: <Links credits={MAP_CREDITS} />.
          </p>
          <p>
            {s.builtWith} <Links credits={LIBRARIES} />.
          </p>
          <p>
            <a href={REPO_URL} target="_blank" rel="noopener">
              {s.source}
            </a>{' '}
            · {COPYRIGHT}
          </p>
        </div>
      )}
      <button
        type="button"
        className={styles.toggle}
        aria-label={s.about.title}
        aria-expanded={open}
        onClick={() => onToggle(!open)}
      >
        i
      </button>
    </div>
  )
}
