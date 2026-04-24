import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

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

function DishCard({ dish, index }) {
  const price = formatPrice(dish.price)
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-3xl border border-amber-200/20 bg-linear-to-b from-amber-50/10 to-amber-950/25 p-6 shadow-[0_20px_45px_rgba(0,0,0,0.35)]"
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-200/10 blur-2xl transition group-hover:bg-amber-100/15" />

      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="rounded-full border border-amber-200/25 bg-amber-100/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-amber-100/90">
          Position {dish.pos ?? '-'}
        </span>
        {price ? <strong className="text-sm font-extrabold text-orange-200">{price}</strong> : null}
      </div>

      <h3 className="font-['Fraunces'] text-2xl leading-tight text-orange-50">{dish.title || 'Gericht'}</h3>
      {dish.description ? <p className="mt-3 text-sm leading-relaxed text-amber-100/80">{dish.description}</p> : null}
    </motion.article>
  )
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [allDishes, setAllDishes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  async function refreshDishes() {
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

  useEffect(() => {
    let isMounted = true

    const loadInitial = async () => {
      try {
        const data = await requestJson('/api/daily_dishes')
        if (!isMounted) return
        setAllDishes(Array.isArray(data) ? data : [])
        setLoadError(null)
      } catch (err) {
        if (!isMounted) return
        setLoadError(err.message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    void loadInitial()

    return () => {
      isMounted = false
    }
  }, [])

  function shiftDate(days) {
    setSelectedDate((prev) => addDays(prev, days))
  }

  function handleDateInput(event) {
    const parsed = new Date(event.target.value)
    if (!Number.isNaN(parsed.getTime())) setSelectedDate(parsed)
  }

  const todayDishes = useMemo(
    () => filterByDate(allDishes, selectedDate).slice().sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0)),
    [allDishes, selectedDate],
  )

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(245,158,11,0.16),transparent_45%),radial-gradient(circle_at_80%_8%,rgba(180,83,9,0.2),transparent_40%),linear-gradient(180deg,#1a120d_0%,#25170f_55%,#2c1b11_100%)] px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="rounded-[34px] border border-amber-100/15 bg-[linear-gradient(130deg,rgba(255,251,235,0.06),rgba(120,53,15,0.22))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.33)] backdrop-blur md:p-8"
        >
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-200/90">Online Speiseplan</p>
              <h1 className="mt-2 font-['Fraunces'] text-4xl leading-[1.03] text-orange-50 md:text-6xl">Kantine mit Seele</h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-amber-100/80 md:text-base">
                Frisch gekocht, taeglich neu. Waehle ein Datum und entdecke die Gerichte in warmen Farben.
              </p>
            </div>
            <div className="grid gap-3">
              <article className="rounded-2xl border border-amber-100/20 bg-amber-50/5 p-4">
                <span className="block text-xs uppercase tracking-[0.14em] text-amber-200/80">Tag</span>
                <strong className="mt-1 block font-semibold text-orange-50">{formatDateLabel(selectedDate)}</strong>
              </article>
              <article className="rounded-2xl border border-amber-100/20 bg-amber-50/5 p-4">
                <span className="block text-xs uppercase tracking-[0.14em] text-amber-200/80">Gerichte heute</span>
                <strong className="mt-1 block font-semibold text-orange-50">{loading ? '...' : `${todayDishes.length} Gerichte`}</strong>
              </article>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.45, ease: 'easeOut' }}
          className="mt-5 rounded-3xl border border-amber-100/15 bg-amber-900/25 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.3)] md:p-5"
        >
          <div className="flex items-center gap-3 md:gap-4">
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full bg-orange-300/20 text-xl text-orange-100 transition hover:-translate-y-0.5 hover:bg-orange-300/30"
              onClick={() => shiftDate(-1)}
              aria-label="Vorheriger Tag"
            >
              -
            </button>
            <div className="flex-1 text-center">
              <strong className="block text-base font-bold text-orange-50 md:text-lg">{formatDateLabel(selectedDate)}</strong>
              <input
                type="date"
                className="mt-2 rounded-xl border border-amber-100/20 bg-black/25 px-3 py-2 text-sm text-orange-50 outline-none transition focus:border-orange-200/60"
                value={toISODateOnly(selectedDate)}
                onChange={handleDateInput}
                aria-label="Datum waehlen"
              />
            </div>
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-full bg-orange-300/20 text-xl text-orange-100 transition hover:-translate-y-0.5 hover:bg-orange-300/30"
              onClick={() => shiftDate(1)}
              aria-label="Naechster Tag"
            >
              +
            </button>
          </div>
        </motion.section>

        <section className="mt-6 rounded-3xl border border-amber-100/15 bg-[linear-gradient(180deg,rgba(255,251,235,0.04),rgba(41,23,15,0.65))] p-5 shadow-[0_22px_65px_rgba(0,0,0,0.35)] md:p-7">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/90">Speiseplan</p>
              <h2 className="mt-1 font-['Fraunces'] text-2xl text-orange-50 md:text-3xl">Gerichte am {formatDateLabel(selectedDate)}</h2>
            </div>
            <button
              type="button"
              className="rounded-full border border-orange-100/25 bg-orange-200/15 px-4 py-2 text-sm font-semibold text-orange-100 transition hover:-translate-y-0.5 hover:bg-orange-200/25 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={refreshDishes}
              disabled={loading}
            >
              Aktualisieren
            </button>
          </div>

          {loadError ? (
            <div className="rounded-2xl border border-rose-300/30 bg-rose-900/25 p-4 text-rose-100">Fehler: {loadError}</div>
          ) : loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-amber-100/15 bg-amber-50/5 p-4 text-amber-100/80"
            >
              Lade...
            </motion.div>
          ) : todayDishes.length === 0 ? (
            <div className="rounded-2xl border border-amber-100/15 bg-amber-50/5 p-4 text-amber-100/80">
              Keine Gerichte fuer diesen Tag eingetragen.
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {todayDishes.map((dish, index) => (
                  <DishCard key={dish.id} dish={dish} index={index} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </section>
      </div>
    </main>
  )
}
