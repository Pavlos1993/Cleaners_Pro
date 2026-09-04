import { useAppStore } from '../store/appStore'

export function TurnoverRulesPage() {
  const turnoverRules = useAppStore((s) => s.turnoverRules)
  const setTurnoverRules = useAppStore((s) => s.setTurnoverRules)
  const assignmentHistoryCount = useAppStore((s) => s.assignmentHistory.length)

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-slate-200 bg-white px-8 py-4">
        <h1 className="font-['Manrope'] text-2xl font-bold text-on-surface">Turnover Rules</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Configure how checkout, arrival prep, and mid-stay cleaning tasks are generated on the Operations board.
        </p>
      </header>

      <div className="mx-auto max-w-xl space-y-6 p-8">
        <section className="rounded-xl border border-slate-200 bg-white p-5 task-card-shadow">
          <div className="flex items-center gap-2">
            <h2 className="font-['Manrope'] text-lg font-bold text-slate-900">Turnover Rules</h2>
            <span
              className="inline-flex cursor-help items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700"
              title="Open the setup guide below for practical examples of each rule."
            >
              i
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            These rules affect how cleanings appear on the Operations board for the selected planning date.
          </p>
          <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              How to configure rules (examples)
            </summary>
            <div className="mt-3 space-y-2 text-xs text-slate-700">
              <p>
                <strong>Cleaning date offset from checkout</strong>: <code>0</code> = cleaning on checkout date,{' '}
                <code>1</code> = next day, <code>-1</code> = one day before checkout.
              </p>
              <p>
                <strong>Arrival Prep</strong>: if enabled with <code>1</code> day before, a check-in on 15 May creates
                a prep cleaning on 14 May.
              </p>
              <p>
                <strong>Mid-stay first clean day + repeat</strong>: first clean day <code>4</code>, repeat every{' '}
                <code>4</code> for a 10-night booking creates cleans on stay day 4 and 8.
              </p>
              <p>
                <strong>Skip mid-stay when checkout is next day</strong>: prevents unnecessary cleanings right before
                turnover.
              </p>
              <p>
                <strong>Planning tip</strong>: switch Operations board to <code>Week</code> or <code>Month</code> to
                preview all rule-generated cleanings ahead.
              </p>
            </div>
          </details>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cleaning date offset from checkout (days)
              </span>
              <input
                type="number"
                min={-3}
                max={7}
                value={turnoverRules.cleaningOffsetDays}
                onChange={(e) =>
                  setTurnoverRules({
                    cleaningOffsetDays: Math.max(-3, Math.min(7, Number(e.target.value) || 0)),
                  })
                }
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none ring-secondary-container focus:ring-2"
              />
              <p className="mt-1 text-xs text-slate-500">Example: set to 2 to schedule checkout cleanings 2 days later.</p>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={turnoverRules.enableArrivalPrep}
                onChange={(e) =>
                  setTurnoverRules({ enableArrivalPrep: e.target.checked })
                }
              />
              <span className="text-sm text-slate-700">
                Create <strong>Arrival Prep</strong> cleaning tasks before check-in
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Arrival prep days before check-in
              </span>
              <input
                type="number"
                min={0}
                max={7}
                disabled={!turnoverRules.enableArrivalPrep}
                value={turnoverRules.arrivalPrepDaysBefore}
                onChange={(e) =>
                  setTurnoverRules({
                    arrivalPrepDaysBefore: Math.max(0, Math.min(7, Number(e.target.value) || 0)),
                  })
                }
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none ring-secondary-container focus:ring-2 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-slate-500">Example: 1 means prep cleaning on the day before check-in.</p>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Default cleaning due time
              </span>
              <input
                type="time"
                value={turnoverRules.defaultCleaningDueTime}
                onChange={(e) =>
                  setTurnoverRules({
                    defaultCleaningDueTime: e.target.value || '12:00',
                  })
                }
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none ring-secondary-container focus:ring-2"
              />
            </label>

            <div className="my-2 border-t border-slate-100 pt-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={turnoverRules.enableMidStay}
                  onChange={(e) =>
                    setTurnoverRules({ enableMidStay: e.target.checked })
                  }
                />
                <span className="text-sm text-slate-700">
                  Create <strong>Mid-stay</strong> cleaning tasks during long stays
                </span>
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Mid-stay first clean on stay day #
              </span>
              <input
                type="number"
                min={2}
                max={30}
                disabled={!turnoverRules.enableMidStay}
                value={turnoverRules.midStayFirstCleanDay}
                onChange={(e) =>
                  setTurnoverRules({
                    midStayFirstCleanDay: Math.max(2, Math.min(30, Number(e.target.value) || 4)),
                  })
                }
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none ring-secondary-container focus:ring-2 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-slate-500">Stay day 1 is the check-in day.</p>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Mid-stay repeat every N days
              </span>
              <input
                type="number"
                min={1}
                max={14}
                disabled={!turnoverRules.enableMidStay}
                value={turnoverRules.midStayRepeatEveryDays}
                onChange={(e) =>
                  setTurnoverRules({
                    midStayRepeatEveryDays: Math.max(1, Math.min(14, Number(e.target.value) || 4)),
                  })
                }
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm outline-none ring-secondary-container focus:ring-2 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-slate-500">Example: every 2 days creates day 2, 4, 6, ...</p>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={turnoverRules.skipMidStayIfCheckoutNextDay}
                onChange={(e) =>
                  setTurnoverRules({
                    skipMidStayIfCheckoutNextDay: e.target.checked,
                  })
                }
                disabled={!turnoverRules.enableMidStay}
              />
              <span className="text-sm text-slate-700">
                Skip mid-stay clean when checkout is next day
              </span>
            </label>

            <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Example with current defaults: for a 10-night booking, clean on day 4 and day 8.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 task-card-shadow">
          <h2 className="font-['Manrope'] text-lg font-bold text-slate-900">Assignment History</h2>
          <p className="mt-1 text-sm text-slate-600">
            Stored locally in your browser/device. This keeps past date assignments so you can see who cleaned where.
            Current records: <strong>{assignmentHistoryCount}</strong>.
          </p>
        </section>
      </div>
    </div>
  )
}

