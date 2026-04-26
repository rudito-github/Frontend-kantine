import { useEffect, useMemo, useState } from 'react'

const TABLE_NAME = 'daily_dishes'

function isoDateToday() {
  return new Date().toISOString().slice(0, 10)
}

function toInputDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function emptyDish() {
  return {
    id: null,
    dish_date: isoDateToday(),
    pos: '',
    title: '',
    description: '',
    price: '',
    is_out: false,
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const raw = await response.text()
  const data = raw ? JSON.parse(raw) : null

  if (!response.ok) {
    throw new Error(data?.error || `Request failed: ${response.status}`)
  }

  return data
}

function parseDishForForm(dish) {
  return {
    id: dish.id,
    dish_date: toInputDate(dish.dish_date),
    pos: dish.pos ?? '',
    title: dish.title ?? '',
    description: dish.description ?? '',
    price: dish.price ?? '',
    is_out: Boolean(dish.is_out),
  }
}

function buildPayload(form) {
  const payload = {
    dish_date: form.dish_date || null,
    title: form.title.trim(),
    description: form.description.trim(),
    is_out: Boolean(form.is_out),
  }

  payload.pos = form.pos === '' ? null : Number(form.pos)
  payload.price = form.price === '' ? null : Number(form.price)

  if (payload.title.length === 0) {
    throw new Error('Titel darf nicht leer sein.')
  }

  if (payload.pos !== null && !Number.isFinite(payload.pos)) {
    throw new Error('Position muss eine Zahl sein.')
  }

  if (payload.price !== null && !Number.isFinite(payload.price)) {
    throw new Error('Preis muss eine Zahl sein.')
  }

  return payload
}

function sortDishes(dishes) {
  return dishes.slice().sort((a, b) => {
    const dateA = String(a.dish_date || '')
    const dateB = String(b.dish_date || '')
    if (dateA !== dateB) return dateA.localeCompare(dateB)

    const posA = Number.isFinite(Number(a.pos)) ? Number(a.pos) : 9999
    const posB = Number.isFinite(Number(b.pos)) ? Number(b.pos) : 9999
    if (posA !== posB) return posA - posB

    return String(a.title || '').localeCompare(String(b.title || ''), 'de')
  })
}

export default function AdminApp() {
  const [dishes, setDishes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(emptyDish)
  const [dateFilter, setDateFilter] = useState(isoDateToday())
  const [showAllDates, setShowAllDates] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadDishes() {
    setLoading(true)
    setError('')
    try {
      const data = await requestJson(`/api/${TABLE_NAME}`)
      setDishes(Array.isArray(data) ? sortDishes(data) : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDishes()
  }, [])

  const visibleDishes = useMemo(() => {
    if (showAllDates) return dishes
    return dishes.filter((dish) => toInputDate(dish.dish_date) === dateFilter)
  }, [dateFilter, dishes, showAllDates])

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function newDish() {
    setSelectedId(null)
    setForm(emptyDish())
    setMessage('Neuer Eintrag.')
    setError('')
  }

  function selectDish(dish) {
    setSelectedId(dish.id)
    setForm(parseDishForForm(dish))
    setMessage(`Eintrag #${dish.id} geladen.`)
    setError('')
  }

  async function saveDish(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const payload = buildPayload(form)
      const isUpdate = selectedId !== null
      const path = isUpdate ? `/api/${TABLE_NAME}/${selectedId}` : `/api/${TABLE_NAME}`
      const method = isUpdate ? 'PUT' : 'POST'

      await requestJson(path, {
        method,
        body: JSON.stringify(payload),
      })

      await loadDishes()
      setMessage(isUpdate ? 'Eintrag aktualisiert.' : 'Eintrag erstellt.')

      if (!isUpdate) {
        setForm(emptyDish())
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteDish() {
    if (selectedId === null) return

    const confirmed = window.confirm(`Eintrag #${selectedId} wirklich loeschen?`)
    if (!confirmed) return

    setSaving(true)
    setError('')
    setMessage('')

    try {
      await requestJson(`/api/${TABLE_NAME}/${selectedId}`, { method: 'DELETE' })
      await loadDishes()
      setSelectedId(null)
      setForm(emptyDish())
      setMessage('Eintrag geloescht.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,rgba(13,148,136,0.22),transparent_30%),radial-gradient(circle_at_100%_0%,rgba(245,158,11,0.2),transparent_28%),linear-gradient(180deg,#061a1c_0%,#0d2326_45%,#1d241f_100%)] px-4 py-6 text-teal-50 md:px-8 md:py-10">
      <div className="mx-auto grid w-full max-w-7xl gap-6 xl:grid-cols-[1.1fr_1.6fr]">
        <section className="rounded-3xl border border-teal-100/15 bg-[linear-gradient(160deg,rgba(45,212,191,0.11),rgba(30,41,59,0.35))] p-6 shadow-[0_28px_72px_rgba(0,0,0,0.35)] backdrop-blur md:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-200/90">Admin</p>
          <h1 className="mt-2 font-['Fraunces'] text-4xl leading-tight text-teal-50">Daily Dishes bearbeiten</h1>
          <p className="mt-3 text-sm text-teal-100/80">
            Tabelle <code className="rounded bg-black/30 px-1.5 py-0.5">{TABLE_NAME}</code> direkt ueber die API pflegen.
          </p>

          <form onSubmit={saveDish} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm text-teal-100/90">Datum</span>
              <input
                type="date"
                name="dish_date"
                value={form.dish_date}
                onChange={handleChange}
                className="w-full rounded-xl border border-teal-100/20 bg-black/25 px-3 py-2.5 outline-none transition focus:border-teal-200/60"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm text-teal-100/90">Position</span>
                <input
                  type="number"
                  name="pos"
                  value={form.pos}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-teal-100/20 bg-black/25 px-3 py-2.5 outline-none transition focus:border-teal-200/60"
                  placeholder="z.B. 1"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm text-teal-100/90">Preis (EUR)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="price"
                  value={form.price}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-teal-100/20 bg-black/25 px-3 py-2.5 outline-none transition focus:border-teal-200/60"
                  placeholder="z.B. 6.90"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm text-teal-100/90">Titel</span>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                className="w-full rounded-xl border border-teal-100/20 bg-black/25 px-3 py-2.5 outline-none transition focus:border-teal-200/60"
                placeholder="Gerichtname"
                required
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-teal-100/90">Beschreibung</span>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                className="min-h-28 w-full rounded-xl border border-teal-100/20 bg-black/25 px-3 py-2.5 outline-none transition focus:border-teal-200/60"
                placeholder="Details, Allergene, Beilagen..."
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-teal-100/15 bg-black/20 px-3 py-2.5">
              <input
                type="checkbox"
                name="is_out"
                checked={form.is_out}
                onChange={handleChange}
                className="h-4 w-4"
              />
              <span className="text-sm text-teal-100">Gericht ausverkauft (`is_out`)</span>
            </label>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="submit"
                className="rounded-full bg-linear-to-r from-teal-400 to-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:-translate-y-0.5 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Speichere...' : selectedId ? 'Aenderungen speichern' : 'Neuen Eintrag speichern'}
              </button>

              <button
                type="button"
                onClick={newDish}
                className="rounded-full border border-teal-100/25 bg-teal-200/10 px-4 py-2.5 text-sm font-semibold text-teal-50 transition hover:-translate-y-0.5"
              >
                Neuer Eintrag
              </button>

              <button
                type="button"
                onClick={deleteDish}
                className="rounded-full border border-rose-200/30 bg-rose-400/10 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                disabled={selectedId === null || saving}
              >
                Eintrag loeschen
              </button>
            </div>
          </form>

          {error ? (
            <p className="mt-4 rounded-xl border border-rose-300/40 bg-rose-900/25 px-3 py-2 text-sm text-rose-100">{error}</p>
          ) : null}
          {message ? (
            <p className="mt-4 rounded-xl border border-emerald-300/35 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-100">{message}</p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-teal-100/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(15,23,42,0.4))] p-5 shadow-[0_28px_72px_rgba(0,0,0,0.35)] md:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/90">Datensaetze</p>
              <h2 className="mt-1 font-['Fraunces'] text-3xl text-teal-50">{visibleDishes.length} Eintraege sichtbar</h2>
            </div>

            <button
              type="button"
              onClick={loadDishes}
              disabled={loading}
              className="rounded-full border border-teal-100/25 bg-teal-200/10 px-4 py-2 text-sm font-semibold text-teal-50 transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {loading ? 'Lade...' : 'Neu laden'}
            </button>
          </div>

          <div className="mb-4 grid gap-3 rounded-2xl border border-teal-100/15 bg-black/25 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <label className="text-sm text-teal-100/90">Filterdatum</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="rounded-xl border border-teal-100/20 bg-black/30 px-3 py-2 text-sm outline-none focus:border-teal-200/60"
            />
            <label className="flex items-center gap-2 text-sm text-teal-100/90">
              <input
                type="checkbox"
                checked={showAllDates}
                onChange={(event) => setShowAllDates(event.target.checked)}
              />
              Alle Daten anzeigen
            </label>
          </div>

          <div className="overflow-auto rounded-2xl border border-teal-100/15">
            <table className="min-w-[760px] w-full border-collapse text-left text-sm">
              <thead className="bg-teal-300/10 text-teal-50">
                <tr>
                  <th className="px-3 py-2.5">ID</th>
                  <th className="px-3 py-2.5">Datum</th>
                  <th className="px-3 py-2.5">Pos</th>
                  <th className="px-3 py-2.5">Titel</th>
                  <th className="px-3 py-2.5">Preis</th>
                  <th className="px-3 py-2.5">Out</th>
                </tr>
              </thead>
              <tbody>
                {visibleDishes.map((dish) => {
                  const isActive = dish.id === selectedId
                  return (
                    <tr
                      key={dish.id}
                      onClick={() => selectDish(dish)}
                      className={`cursor-pointer border-t border-teal-100/10 transition ${
                        isActive ? 'bg-teal-200/20' : 'hover:bg-teal-100/10'
                      }`}
                    >
                      <td className="px-3 py-2">{dish.id}</td>
                      <td className="px-3 py-2">{toInputDate(dish.dish_date)}</td>
                      <td className="px-3 py-2">{dish.pos ?? '-'}</td>
                      <td className="px-3 py-2">{dish.title || '-'}</td>
                      <td className="px-3 py-2">{dish.price ?? '-'}</td>
                      <td className="px-3 py-2">{dish.is_out ? 'Ja' : 'Nein'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!loading && visibleDishes.length === 0 ? (
            <p className="mt-4 rounded-xl border border-teal-100/15 bg-black/20 px-3 py-2 text-sm text-teal-100/80">
              Keine Eintraege fuer den aktuellen Filter gefunden.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  )
}
