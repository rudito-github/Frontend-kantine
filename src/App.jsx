import { useEffect, useState } from 'react'
import './App.css'

const defaultTable = 'daily_dishes'
const defaultPayload = '{\n  "name": "Schnitzel",\n  "preis": 12.5\n}'
const todayLabel = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
}).format(new Date())

const dateFieldCandidates = ['dish_date', 'datum', 'date', 'menu_date', 'gueltig_am']
const weekdayFieldCandidates = ['wochentag', 'weekday', 'day', 'tag']
const titleFieldCandidates = ['title', 'name', 'gericht', 'titel', 'bezeichnung']
const descriptionFieldCandidates = [
  'description',
  'beschreibung',
  'details',
  'info',
]
const priceFieldCandidates = ['price', 'preis', 'kosten']
const categoryFieldCandidates = ['kategorie', 'category', 'typ']

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const rawText = await response.text()
  const data = rawText ? JSON.parse(rawText) : null

  if (!response.ok) {
    throw new Error(
      data?.error || `Request failed with status ${response.status}`,
    )
  }

  return data
}

function formatValue(value) {
  if (value === null) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function normalizeText(value) {
  return normalizeKey(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function findField(record, candidates) {
  const entries = Object.entries(record || {})
  return entries.find(([key]) => candidates.includes(normalizeKey(key)))
}

function parseAsDate(value) {
  if (!value) return null

  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
    if (match) {
      const [, day, month, year] = match
      const fallback = new Date(Number(year), Number(month) - 1, Number(day))
      return Number.isNaN(fallback.getTime()) ? null : fallback
    }
  }

  return null
}

function isSameDay(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  )
}

function getWeekdayAliases(date) {
  const german = new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(
    date,
  )
  const english = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(
    date,
  )

  return new Set([
    normalizeText(german),
    normalizeText(english),
    normalizeText(german.slice(0, 2)),
    normalizeText(german.slice(0, 3)),
    normalizeText(english.slice(0, 3)),
  ])
}

function priceLabel(record) {
  const field = findField(record, priceFieldCandidates)
  if (
    !field ||
    field[1] === null ||
    field[1] === undefined ||
    field[1] === ''
  ) {
    return null
  }

  const value = Number(field[1])
  if (Number.isFinite(value)) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(value)
  }

  return String(field[1])
}

function dishTitle(record) {
  const field = findField(record, titleFieldCandidates)
  return field?.[1] ? String(field[1]) : `Gericht ${record.id ?? ''}`.trim()
}

function dishDescription(record) {
  const field = findField(record, descriptionFieldCandidates)
  return field?.[1] ? String(field[1]) : 'Heute frisch aus der Küche.'
}

function dishCategory(record) {
  const field = findField(record, categoryFieldCandidates)
  return field?.[1] ? String(field[1]) : null
}

function deriveTodayMenu(records) {
  const today = new Date()
  const weekdayAliases = getWeekdayAliases(today)

  const withDate = records.filter((record) => {
    const field = findField(record, dateFieldCandidates)
    if (!field) return false
    const parsed = parseAsDate(field[1])
    return parsed ? isSameDay(parsed, today) : false
  })

  if (withDate.length > 0) {
    return {
      items: withDate,
      reason: 'date-match',
      hint: 'Gefiltert nach Datum.',
    }
  }

  const withWeekday = records.filter((record) => {
    const field = findField(record, weekdayFieldCandidates)
    if (!field) return false
    return weekdayAliases.has(normalizeText(field[1]))
  })

  if (withWeekday.length > 0) {
    return {
      items: withWeekday,
      reason: 'weekday-match',
      hint: 'Gefiltert nach Wochentag.',
    }
  }

  return {
    items: records,
    reason: 'fallback-all',
    hint: 'Keine Datumsspalte erkannt. Es werden alle Gerichte aus daily_dishes angezeigt.',
  }
}

function CustomerDishCard({ dish }) {
  const price = priceLabel(dish)
  const category = dishCategory(dish)

  return (
    <article className="dish-card">
      <div className="dish-card-topline">
        {category ? (
          <span className="dish-badge">{category}</span>
        ) : (
          <span className="dish-badge ghost">Tagesgericht</span>
        )}
        {price ? <strong className="dish-price">{price}</strong> : null}
      </div>
      <h3>{dishTitle(dish)}</h3>
      <p>{dishDescription(dish)}</p>
    </article>
  )
}

function App() {
  const [viewMode, setViewMode] = useState('kunde')
  const [tableName, setTableName] = useState(defaultTable)
  const [records, setRecords] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [payloadText, setPayloadText] = useState(defaultPayload)
  const [status, setStatus] = useState(
    'Bereit. Wähle eine Tabelle und lade Daten.',
  )
  const [health, setHealth] = useState('Prüfe Backend...')
  const [isLoading, setIsLoading] = useState(false)
  const [customerMenu, setCustomerMenu] = useState([])
  const [customerInfo, setCustomerInfo] = useState('Lade Tagesgerichte...')
  const [customerLoading, setCustomerLoading] = useState(false)

  async function fetchCustomerMenu() {
    setCustomerLoading(true)

    try {
      const data = await requestJson('/api/daily_dishes')
      const menu = deriveTodayMenu(data)
      setCustomerMenu(menu.items)
      setCustomerInfo(menu.hint)
    } catch (error) {
      setCustomerMenu([])
      setCustomerInfo(error.message)
    } finally {
      setCustomerLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false

    async function loadInitialData() {
      try {
        const data = await requestJson('/health')
        if (!ignore) {
          setHealth(
            data.status === 'ok'
              ? 'Backend erreichbar'
              : 'Backend antwortet unerwartet',
          )
        }
      } catch {
        if (!ignore) {
          setHealth('Backend nicht erreichbar')
        }
      }

      if (!ignore) {
        await fetchCustomerMenu()
      }
    }

    loadInitialData()

    return () => {
      ignore = true
    }
  }, [])

  async function loadRecords(nextSelectedId = null) {
    const currentTable = tableName.trim()

    if (!currentTable) {
      setStatus('Bitte einen Tabellennamen eintragen.')
      return
    }

    setIsLoading(true)
    setStatus(`Lade Daten aus ${currentTable}...`)

    try {
      const data = await requestJson(`/api/${currentTable}`)
      setRecords(data)

      if (
        nextSelectedId !== null &&
        data.some((entry) => String(entry.id) === String(nextSelectedId))
      ) {
        setSelectedId(String(nextSelectedId))
      } else if (data[0] && data[0].id !== undefined && data[0].id !== null) {
        setSelectedId(String(data[0].id))
      } else {
        setSelectedId(null)
      }

      setStatus(`${data.length} Datensätze aus ${currentTable} geladen.`)
    } catch (error) {
      setStatus(error.message)
      setRecords([])
      setSelectedId(null)
    } finally {
      setIsLoading(false)
    }
  }

  function parsePayload() {
    try {
      const parsed = JSON.parse(payloadText)

      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('JSON muss ein Objekt sein.')
      }

      return parsed
    } catch (error) {
      throw new Error(`Ungültiges JSON: ${error.message}`, { cause: error })
    }
  }

  async function createRecord() {
    const currentTable = tableName.trim()

    if (!currentTable) {
      setStatus('Bitte einen Tabellennamen eintragen.')
      return
    }

    setIsLoading(true)

    try {
      const payload = parsePayload()
      const data = await requestJson(`/api/${currentTable}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setStatus(`Datensatz ${data.id ?? ''} wurde erstellt.`.trim())
      await loadRecords(data.id ?? null)
      if (currentTable === 'daily_dishes') {
        await fetchCustomerMenu()
      }
    } catch (error) {
      setStatus(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function updateRecord() {
    const currentTable = tableName.trim()

    if (!currentTable) {
      setStatus('Bitte einen Tabellennamen eintragen.')
      return
    }

    if (!selectedId) {
      setStatus('Bitte zuerst einen Datensatz mit id auswählen.')
      return
    }

    setIsLoading(true)

    try {
      const payload = parsePayload()
      const data = await requestJson(`/api/${currentTable}/${selectedId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      setStatus(`Datensatz ${data.id ?? selectedId} wurde aktualisiert.`)
      await loadRecords(selectedId)
      if (currentTable === 'daily_dishes') {
        await fetchCustomerMenu()
      }
    } catch (error) {
      setStatus(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function deleteRecord() {
    const currentTable = tableName.trim()

    if (!currentTable) {
      setStatus('Bitte einen Tabellennamen eintragen.')
      return
    }

    if (!selectedId) {
      setStatus('Bitte zuerst einen Datensatz mit id auswählen.')
      return
    }

    setIsLoading(true)

    try {
      await requestJson(`/api/${currentTable}/${selectedId}`, {
        method: 'DELETE',
      })

      setStatus(`Datensatz ${selectedId} wurde gelöscht.`)
      await loadRecords()
      if (currentTable === 'daily_dishes') {
        await fetchCustomerMenu()
      }
    } catch (error) {
      setStatus(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  function selectRecord(record) {
    if (record.id === undefined || record.id === null) {
      setStatus(
        'Dieser Datensatz hat keine id und kann nicht direkt bearbeitet werden.',
      )
      return
    }

    setSelectedId(String(record.id))
    setPayloadText(JSON.stringify(record, null, 2))
    setStatus(`Datensatz ${record.id} ausgewählt.`)
  }

  const columns = Array.from(
    records.reduce((keys, record) => {
      Object.keys(record).forEach((key) => keys.add(key))
      return keys
    }, new Set()),
  )

  return (
    <main className="app-shell">
      <section className="hero-panel customer-hero">
        <div>
          <p className="eyebrow">Online Speiseplan</p>
          <h1>Heute auf dem Teller</h1>
          <p className="lead">
            Kundenseite fuer die aktuellen Gerichte des Tages. Die Daten kommen
            direkt aus <span>/api/daily_dishes</span>.
          </p>
          <div className="view-switch">
            <button
              type="button"
              className={
                viewMode === 'kunde' ? 'secondary is-active' : 'secondary'
              }
              onClick={() => setViewMode('kunde')}
            >
              Kundenansicht
            </button>
            <button
              type="button"
              className={
                viewMode === 'admin' ? 'secondary is-active' : 'secondary'
              }
              onClick={() => setViewMode('admin')}
            >
              Verwaltung
            </button>
          </div>
        </div>

        <div className="hero-status-grid">
          <article>
            <span>Backend</span>
            <strong>{health}</strong>
          </article>
          <article>
            <span>Heute</span>
            <strong>{todayLabel}</strong>
          </article>
          <article>
            <span>Tagesgerichte</span>
            <strong>
              {customerLoading ? 'Lade...' : `${customerMenu.length} Gerichte`}
            </strong>
          </article>
        </div>
      </section>

      <section className="panel customer-panel">
        <div className="panel-header customer-panel-header">
          <div>
            <p className="panel-kicker">Kundenbereich</p>
            <h2>Gerichte des aktuellen Tages</h2>
          </div>
          <button
            type="button"
            onClick={fetchCustomerMenu}
            disabled={customerLoading}
          >
            Aktualisieren
          </button>
        </div>

        <div className="status-box customer-info-box">
          <span>Info</span>
          <p>{customerInfo}</p>
        </div>

        {customerMenu.length === 0 ? (
          <div className="empty-state customer-empty-state">
            <p>
              Es konnten keine Tagesgerichte gefunden werden. Pruefe die Tabelle{' '}
              <code>daily_dishes</code> und optional Felder wie <code>datum</code>{' '}
              oder <code>wochentag</code>.
            </p>
          </div>
        ) : (
          <div className="dish-grid">
            {customerMenu.map((dish) => (
              <CustomerDishCard
                key={dish.id ?? JSON.stringify(dish)}
                dish={dish}
              />
            ))}
          </div>
        )}
      </section>

      {viewMode === 'admin' ? (
        <>
          <section className="workspace-grid">
            <article className="panel controls-panel">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Datenquelle</p>
                  <h2>Tabelle laden</h2>
                </div>
              </div>

              <label className="field">
                <span>Tabellenname</span>
                <input
                  value={tableName}
                  onChange={(event) => setTableName(event.target.value)}
                  placeholder="daily_dishes"
                />
              </label>

              <div className="button-row">
                <button
                  type="button"
                  onClick={() => loadRecords()}
                  disabled={isLoading || !tableName.trim()}
                >
                  Daten laden
                </button>
              </div>

              <div className="status-box">
                <span>Status</span>
                <p>{status}</p>
              </div>

              <div className="hint-box">
                <strong>Voraussetzung</strong>
                <p>
                  Deine Tabelle sollte eine Spalte <code>id</code> besitzen,
                  weil das Backend fuer Update und Delete darauf zugreift.
                </p>
              </div>
            </article>

            <article className="panel editor-panel">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">CRUD</p>
                  <h2>JSON-Payload</h2>
                </div>
              </div>

              <label className="field field-large">
                <span>Request-Body fuer POST oder PUT</span>
                <textarea
                  value={payloadText}
                  onChange={(event) => setPayloadText(event.target.value)}
                  spellCheck="false"
                />
              </label>

              <div className="button-row">
                <button
                  type="button"
                  onClick={createRecord}
                  disabled={isLoading || !tableName.trim()}
                >
                  Neu anlegen
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={updateRecord}
                  disabled={isLoading || !selectedId}
                >
                  Aktualisieren
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={deleteRecord}
                  disabled={isLoading || !selectedId}
                >
                  Loeschen
                </button>
              </div>
            </article>
          </section>

          <section className="panel table-panel admin-panel">
            <div className="panel-header table-header">
              <div>
                <p className="panel-kicker">Datensaetze</p>
                <h2>Antwort aus /api/{tableName.trim() || ':table'}</h2>
              </div>
              <span className="record-count">{records.length} Eintraege</span>
            </div>

            {records.length === 0 ? (
              <div className="empty-state">
                <p>
                  Keine Daten geladen. Trage einen Tabellennamen ein und lade
                  die Datensaetze.
                </p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr
                        key={record.id ?? JSON.stringify(record)}
                        className={
                          String(record.id) === selectedId ? 'is-selected' : ''
                        }
                        onClick={() => selectRecord(record)}
                      >
                        {columns.map((column) => (
                          <td key={`${record.id ?? column}-${column}`}>
                            {formatValue(record[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  )
}

export default App
