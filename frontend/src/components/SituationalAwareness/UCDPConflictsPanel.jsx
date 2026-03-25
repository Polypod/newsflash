import React, { useState } from 'react';

// violence_type → display label + colour
const VIOLENCE_META = {
  'state-based': { label: 'State-based', color: 'bg-red-100 text-red-800' },
  'non-state':   { label: 'Non-state',   color: 'bg-orange-100 text-orange-800' },
  'one-sided':   { label: 'One-sided',   color: 'bg-purple-100 text-purple-800' },
};

// intensity → label + colour
const INTENSITY_META = {
  2: { label: 'War',   color: 'bg-red-100 text-red-800' },
  1: { label: 'Minor', color: 'bg-yellow-100 text-yellow-800' },
};

function DeathBar({ best, low, high }) {
  if (best == null && low == null && high == null) return <span className="text-gray-400 text-xs">unknown</span>;
  const fmt = (n) => (n ?? 0).toLocaleString();
  return (
    <span className="text-xs font-medium text-gray-700">
      {fmt(best)}
      {(low !== best || high !== best) && (
        <span className="text-gray-400 font-normal"> ({fmt(low)}–{fmt(high)})</span>
      )}
    </span>
  );
}

function EventRow({ event }) {
  const meta = VIOLENCE_META[event.violence_label] || { label: event.violence_label, color: 'bg-gray-100 text-gray-700' };
  return (
    <div className="px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-900 truncate">{event.conflict_name || event.dyad_name || '—'}</p>
          <p className="text-xs text-gray-500 truncate">{event.country} · {event.event_date}</p>
          {event.source_headline && (
            <p className="text-xs text-gray-400 italic truncate mt-0.5">{event.source_headline}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${meta.color}`}>
            {meta.label}
          </span>
          <DeathBar best={event.fatalities_best} low={event.fatalities_low} high={event.fatalities_high} />
        </div>
      </div>
    </div>
  );
}

function ConflictRow({ conflict }) {
  const meta = INTENSITY_META[conflict.intensity_level] || { label: '?', color: 'bg-gray-100 text-gray-600' };
  return (
    <div className="px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-900 truncate">{conflict.side_a} vs {conflict.side_b}</p>
          <p className="text-xs text-gray-500">{conflict.location} · {conflict.incompatibility} · {conflict.year}</p>
        </div>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${meta.color}`}>
          {meta.label}
        </span>
      </div>
    </div>
  );
}

export default function UCDPConflictsPanel({ events = [], conflicts = [] }) {
  const [tab, setTab] = useState('events');

  const isEmpty = !events.length && !conflicts.length;

  if (isEmpty) {
    return (
      <div className="text-center py-6 text-sm text-gray-400">
        No UCDP data yet.
        <br />
        <span className="text-xs">Populated by the ucdp-ged background job (daily sync).</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Source attribution */}
      <p className="text-xs text-gray-400">
        Source:{' '}
        <a
          href="https://ucdp.uu.se/encyclopedia"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-600"
        >
          UCDP
        </a>{' '}
        · Uppsala Conflict Data Program · v25.1 (events through 2024)
      </p>

      {/* Tab switcher */}
      <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
        <button
          onClick={() => setTab('events')}
          className={`flex-1 py-1 font-medium transition-colors ${
            tab === 'events' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          GED Events ({events.length})
        </button>
        <button
          onClick={() => setTab('conflicts')}
          className={`flex-1 py-1 font-medium transition-colors border-l border-gray-200 ${
            tab === 'conflicts' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Active Conflicts ({conflicts.length})
        </button>
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg">
        {tab === 'events' ? (
          events.length ? (
            events.map((e, i) => <EventRow key={e.external_id || i} event={e} />)
          ) : (
            <p className="text-center py-4 text-xs text-gray-400">No GED events in DB yet</p>
          )
        ) : (
          conflicts.length ? (
            conflicts.map((c, i) => <ConflictRow key={`${c.dyad_id}-${i}`} conflict={c} />)
          ) : (
            <p className="text-center py-4 text-xs text-gray-400">No active conflicts in DB yet</p>
          )
        )}
      </div>
    </div>
  );
}
