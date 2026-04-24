import { useEffect, useState } from 'react'
import './App.css'

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatDateLabel(date) {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function toISODateOnly(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const rawText = await response.text()
  const data = rawText ? JSON.parse(rawText) : null
  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`)
  }
  return data
}

function formatPrice(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(num)
}

function filterByDate(dishes, targetDate) {
  const iso = toISODateOnly(targetDate)
  return dishes.filter((d) => d.dish_date && String(d.dish_date).slice(0, 10) === iso)
}

// ─── Kundenkarte ──────────────────────────────────────────────────────────────

function DishCard({ dish }) {
  const price = formatPrice(dish.price)
  return (
    <article className="dish-card">
      <div className="dish-card-topline">
        <span className="dish-badge ghost">Nr. {dish.pos ?? '–'}</span>
        {price ? <strong className="dish-price">{price}</strong> : null}
      </div>
      <h3>{dish.title || 'Gericht'}</h3>
      {dish.description ? <p>{dish.description}</p> : null}
    </article>
  )
}

// ─── Admin-Formular ───────────────────────────────────────────────────────────

const emptyForm = {
  dish_date: toISODateOnly(new Date()),
  title: '',
  description: '',
  price: '',
  pos: 1,
}

function DishForm({ initial, onSave, onDelete, onCancel }) {
  const [form, setForm] = useState(
    initial
      ? {
          dish_date: String(initial.dish_date ?? '').slice(0, 10),
          title: initial.title ?? '',
          description: initial.description ?? '',
          price: initial.price ?? '',
          pos: initial.pos ?? 1,
        }
      : emptyForm,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(event) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const payload = {
        dish_date: form.dish_date,
        title: form.title.trim(),
        description: form.description.trim() || null,
        price: parseFloat(String(form.price).replace(',', '.')),
        pos: parseInt(form.pos, 10) || 1,
      }
      if (!payload.title) throw new Error('Titel ist erforderlich.')
      if (!Number.isFinite(payload.price)) throw new Error('Preis muss eine Zahl sein.')
      await onSave(payload)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Eintrag wirklich löschen?')) return
    setError(null)
    setBusy(true)
    try {
      await onDelete()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const isEdit = Boolean(initial?.id)

  return (
    <form className="dish-form" onSubmit={handleSave}>
      <div className="dish-form-grid">
        <label className="field">
          <span>Datum</span>
          <input type="date" value={form.dish_date} onChange={(e) => set('dish_date', e.target.value)} required />
        </label>

        <label className="field">
          <span>Position</span>
          <input type="number" min="1" value={form.pos} onChange={(e) => set('pos', e.target.value)} required />
        </label>

        <label className="field dish-form-title">
          <span>Titel</span>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Schnitzel mit Pommes"
            required
          />
        </label>

        <label className="field">
          <span>Preis (€)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => set('price', e.target.value)}
            placeholder="9.90"
            required
          />
        </label>

        <label className="field dish-form-desc">
          <span>Beschreibung (optional)</span>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="z. B. Beilagen, Allergene…"
          />
        </label>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="button-row">
        <button type="submit" disabled={busy}>
          {isEdit ? 'Speichern' : 'Neu anlegen'}
        </button>
        {isEdit ? (
          <button type="button" className="danger" onClick={handleDelete} disabled={busy}>
            Löschen
          </button>
        ) : null}
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
          Abbrechen
        </button>
      </div>
    </form>
  )
}

// ─── Admin-Tabellenzeile ──────────────────────────────────────────────────────

function AdminRow({ dish, onSelect }) {
  return (
    <tr onClick={() => onSelect(dish)}>
      <td>{String(dish.dish_date).slice(0, 10)}</td>
      <td>{dish.pos}</td>
      <td>{dish.title}</td>
      <td>{formatPrice(dish.price)}</td>
      <td className="row-hint">bearbeiten →</td>
    </tr>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [viewMode, setViewMode] = useState('kunde')

  // Kundenseite
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [allDishes, setAllDishes] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)

  // Admin
  const [editDish, setEditDish] = useState(null) // null=zu, {}=neu, dish=edit

  const todayDishes = filterByDate(allDishes, selectedDate)

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await requestJson('/api/daily_dishes')
      setAllDishes(Array.isArray(data) ? data : [])
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  function shiftDate(days) {
    setSelectedDate((prev) => addDays(prev, days))
  }

  function handleDateInput(e) {
    const parsed = new Date(e.target.value)
    if (!Number.isNaN(parsed.getTime())) setSelectedDate(parsed)
  }

  async function handleSave(payload) {
    if (editDish?.id) {
      await requestJson(`/api/daily_dishes/${editDish.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    } else {
      await requestJson('/api/daily_dishes', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    }
    setEditDish(null)
    await loadAll()
  }

  async function handleDelete() {
    if (!editDish?.id) return
    await requestJson(`/api/daily_dishes/${editDish.id}`, { method: 'DELETE' })
    setEditDish(null)
    await loadAll()
  }

  return (
    <main className="app-shell">

      {/* Header */}
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Online Speiseplan</p>
          <h1>Heute auf dem Teller</h1>
          <div className="view-switch">
            <button
              type="button"
              className={viewMode === 'kunde' ? 'secondary is-active' : 'secondary'}
              onClick={() => setViewMode('kunde')}
            >
              Speiseplan
            </button>
            <button
              type="button"
              className={viewMode === 'admin' ? 'secondary is-active' : 'secondary'}
              onClick={() => setViewMode('admin')}
            >
              Verwaltung
            </button>
          </div>
        </div>

        <div className="hero-status-grid">
          <article>
            <span>Tag</span>
            <strong>{formatDateLabel(selectedDate)}</strong>
          </article>
          <article>
            <span>Gerichte heute</span>
            <strong>{loading ? '…' : `${todayDishes.length} Gerichte`}</strong>
          </article>
          <article>
            <span>Gesamt in DB</span>
            <strong>{loading ? '…' : `${allDishes.length} Einträge`}</strong>
          </article>
        </div>
      </section>

      {/* Datumsnavigation */}
      <div className="panel date-nav-panel">
        <button
          type="button"
          className="date-nav-btn secondary"
          onClick={() => shiftDate(-1)}
          aria-label="Vorheriger Tag"
        >
          −
        </button>
        <div className="date-nav-center">
          <strong className="date-nav-label">{formatDateLabel(selectedDate)}</strong>
          <input
            type="date"
            className="date-nav-input"
            value={toISODateOnly(selectedDate)}
            onChange={handleDateInput}
            aria-label="Datum wählen"
          />
        </div>
        <button
          type="button"
          className="date-nav-btn secondary"
          onClick={() => shiftDate(1)}
          aria-label="Nächster Tag"
        >
          +
        </button>
      </div>

      {/* Kundenansicht */}
      {viewMode === 'kunde' && (
        <section className="panel customer-panel">
          <div className="panel-header customer-panel-header">
            <div>
              <p className="panel-kicker">Speiseplan</p>
              <h2>Gerichte am {formatDateLabel(selectedDate)}</h2>
            </div>
            <button type="button" onClick={loadAll} disabled={loading}>
              Aktualisieren
            </button>
          </div>

          {loadError ? (
            <div className="empty-state"><p>Fehler: {loadError}</p></div>
          ) : loading ? (
            <div className="empty-state"><p>Lade…</p></div>
          ) : todayDishes.length === 0 ? (
            <div className="empty-state">
              <p>Keine Gerichte für diesen Tag eingetragen.</p>
            </div>
          ) : (
            <div className="dish-grid">
              {todayDishes
                .slice()
                .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0))
                .map((dish) => (
                  <DishCard key={dish.id} dish={dish} />
                ))}
            </div>
          )}
        </section>
      )}

      {/* Verwaltungsansicht */}
      {viewMode === 'admin' && (
        <section className="panel admin-section">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Verwaltung</p>
              <h2>Einträge in daily_dishes</h2>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => setEditDish({})}
            >
              + Neuer Eintrag
            </button>
          </div>

          {editDish !== null && (
            <DishForm
              initial={editDish?.id ? editDish : null}
              onSave={handleSave}
              onDelete={handleDelete}
              onCancel={() => setEditDish(null)}
            />
          )}

          {allDishes.length === 0 ? (
            <div className="empty-state"><p>Keine Einträge vorhanden.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Pos</th>
                    <th>Titel</th>
                    <th>Preis</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {allDishes
                    .slice()
                    .sort((a, b) => {
                      const d = String(b.dish_date).localeCompare(String(a.dish_date))
                      return d !== 0 ? d : (a.pos ?? 0) - (b.pos ?? 0)
                    })
                    .map((dish) => (
                      <AdminRow
                        key={dish.id}
                        dish={dish}
                        onSelect={setEditDish}
                      />
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

    </main>
  )
}
