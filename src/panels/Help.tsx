import { SHORTCUTS } from '../shortcuts'

interface Props {
  open: boolean
  onToggle: (open: boolean) => void
}

/** The keyboard legend as a floating panel bottom-right, behind a ? button. */
export function Help({ open, onToggle }: Props) {
  return (
    <div className="help">
      {open && (
        <dl className="help-panel" role="dialog" aria-label="Keyboard shortcuts">
          {SHORTCUTS.map(({ keys, does }) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{does}</dd>
            </div>
          ))}
        </dl>
      )}
      <button
        type="button"
        className="help-toggle"
        aria-label="Keyboard shortcuts"
        aria-expanded={open}
        onClick={() => onToggle(!open)}
      >
        ?
      </button>
    </div>
  )
}
