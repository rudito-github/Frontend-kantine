import { useEffect, useState } from 'react'
import './App.css'

const defaultTable = 'gerichte'
const defaultPayload = '{\n  "name": "Schnitzel",\n  "preis": 12.5\n}'

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
    throw new Error(data?.error || `Request failed with status ${response.status}`)
  }

  return data
}

function formatValue(value) {
  if (value === null) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function App() {
  const [tableName, setTableName] = useState(defaultTable)
  const [records, setRecords] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [payloadText, setPayloadText] = useState(defaultPayload)
  const [status, setStatus] = useState('Bereit. Wähle eine Tabelle und lade Daten.')
  const [health, setHealth] = useState('Prüfe Backend...')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let ignore = false

    async function checkHealth() {
      try {
        const data = await requestJson('/health')
        if (!ignore) {
          setHealth(data.status === 'ok' ? 'Backend erreichbar' : 'Backend antwortet unerwartet')
        }
      } catch {
        if (!ignore) {
          setHealth('Backend nicht erreichbar')
        }
      }
    }

    checkHealth()

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
    } catch (error) {
      setStatus(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  function selectRecord(record) {
    if (record.id === undefined || record.id === null) {
      setStatus('Dieser Datensatz hat keine id und kann nicht direkt bearbeitet werden.')
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
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Online Speiseplan</p>
          <h1>React-Frontend für dein Express/PostgreSQL-Backend</h1>
          <p className="lead">
            Diese Oberfläche spricht direkt mit deinen generischen CRUD-Routen unter{' '}
            <span>/api/:table</span>.
          </p>
        </div>

        <div className="hero-status-grid">
          <article>
            <span>Backend</span>
            <strong>{health}</strong>
          </article>
          <article>
            <span>Aktive Tabelle</span>
            <strong>{tableName.trim() || 'keine'}</strong>
          </article>
          <article>
            <span>Ausgewählte ID</span>
            <strong>{selectedId || 'keine'}</strong>
          </article>
        </div>
      </section>

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
              placeholder="gerichte"
            />
          </label>

          <div className="button-row">
            <button type="button" onClick={() => loadRecords()} disabled={isLoading || !tableName.trim()}>
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
              Deine Tabelle sollte eine Spalte <code>id</code> besitzen, weil das Backend für Update und Delete darauf zugreift.
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
            <span>Request-Body für POST oder PUT</span>
            <textarea
              value={payloadText}
              onChange={(event) => setPayloadText(event.target.value)}
              spellCheck="false"
            />
          </label>

          <div className="button-row">
            <button type="button" onClick={createRecord} disabled={isLoading || !tableName.trim()}>
              Neu anlegen
            </button>
            <button type="button" className="secondary" onClick={updateRecord} disabled={isLoading || !selectedId}>
              Aktualisieren
            </button>
            <button type="button" className="danger" onClick={deleteRecord} disabled={isLoading || !selectedId}>
              Löschen
            </button>
          </div>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="panel-header table-header">
          <div>
            <p className="panel-kicker">Datensätze</p>
            <h2>Antwort aus /api/{tableName.trim() || ':table'}</h2>
          </div>
          <span className="record-count">{records.length} Einträge</span>
        </div>

        {records.length === 0 ? (
          <div className="empty-state">
            <p>Keine Daten geladen. Trage einen Tabellennamen ein und lade die Datensätze.</p>
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
                    className={String(record.id) === selectedId ? 'is-selected' : ''}
                    onClick={() => selectRecord(record)}
                  >
                    {columns.map((column) => (
                      <td key={`${record.id ?? column}-${column}`}>{formatValue(record[column])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
