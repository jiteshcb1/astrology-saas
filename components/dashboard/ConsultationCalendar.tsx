"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { toneHex } from "./Charts";
import { DEMO_LATER, DEMO_NEXT_DAY, DEMO_PAST, DEMO_TODAY, type DemoConsultation } from "@/lib/demo-data";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function ConsultationCalendar() {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();

  const eventsByDay = useMemo(() => {
    const map: Record<number, DemoConsultation[]> = {};
    if (!isCurrentMonth) return map;
    const d = today.getDate();
    const place = (day: number, items: DemoConsultation[]) => {
      if (day >= 1 && day <= daysInMonth) map[day] = items;
    };
    place(d, DEMO_TODAY);
    place(d + 1, DEMO_NEXT_DAY);
    place(d + 5, DEMO_LATER);
    place(d - 2, DEMO_PAST);
    return map;
  }, [isCurrentMonth, today, daysInMonth]);

  const selectedEvents = eventsByDay[selectedDay] ?? [];

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
    setSelectedDay(1);
  }

  function copy(link: string, id: string) {
    navigator.clipboard?.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <Card>
      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        {/* Calendar */}
        <div>
          <div className="mb-4 flex items-center gap-3">
            <button type="button" onClick={() => shiftMonth(-1)} className="grid h-8 w-8 place-items-center rounded-control border border-line text-muted hover:border-marigold">
              ‹
            </button>
            <h2 className="font-display text-xl text-ink">
              {MONTHS[viewMonth]} {viewYear}
            </h2>
            <button type="button" onClick={() => shiftMonth(1)} className="grid h-8 w-8 place-items-center rounded-control border border-line text-muted hover:border-marigold">
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-line pb-2 text-center text-xs uppercase tracking-wide text-muted">
            {WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) return <div key={`b${i}`} className="min-h-[78px] border-b border-r border-line first:border-l" />;
              const isToday = isCurrentMonth && day === today.getDate();
              const isSelected = day === selectedDay;
              const events = eventsByDay[day] ?? [];
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[78px] border-b border-r border-line p-1.5 text-left align-top transition hover:bg-sand-2/30 [&:nth-child(7n+1)]:border-l ${
                    isSelected ? "bg-sand-2/40" : ""
                  }`}
                >
                  <span
                    className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs ${
                      isToday ? "bg-night font-semibold text-sand" : isSelected ? "ring-1 ring-marigold text-ink" : "text-ink"
                    }`}
                  >
                    {day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {events.slice(0, 2).map((e) => (
                      <div
                        key={e.id}
                        className="truncate rounded px-1.5 py-0.5 text-[0.62rem]"
                        style={{ backgroundColor: `${toneHex(e.tone)}22`, color: toneHex(e.tone) }}
                      >
                        {e.title}
                      </div>
                    ))}
                    {events.length > 2 && <div className="px-1.5 text-[0.6rem] text-muted">+{events.length - 2} more</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day rail */}
        <div>
          <h3 className="mb-4 font-display text-lg text-ink">
            {selectedDay} {MONTHS[viewMonth]} {viewYear}
          </h3>
          {selectedEvents.length === 0 ? (
            <EmptyState title="No consultations" message="Nothing scheduled for this day." />
          ) : (
            <ul className="space-y-4">
              {selectedEvents.map((e) => (
                <li key={e.id} className="border-l-2 pl-3" style={{ borderColor: toneHex(e.tone) }}>
                  <div className="text-xs text-muted">{e.time}</div>
                  <div className="font-medium text-ink">{e.title}</div>
                  <div className="text-xs text-muted">
                    {e.seekerName} · {e.seekerEmail}
                  </div>
                  {e.upcoming && (
                    <div className="mt-2 flex items-center gap-2">
                      <a
                        href={e.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-control bg-marigold px-3 py-1.5 text-xs font-semibold text-night transition hover:-translate-y-0.5"
                      >
                        Join
                      </a>
                      <button
                        type="button"
                        onClick={() => copy(e.meetLink, e.id)}
                        title="Copy meeting link"
                        className="grid h-7 w-7 place-items-center rounded-control border border-line text-muted transition hover:border-marigold"
                      >
                        {copiedId === e.id ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" strokeLinecap="round" /></svg>
                        )}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
