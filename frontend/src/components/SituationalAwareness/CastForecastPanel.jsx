import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// Colour palette matching the CAST event categories
const CATEGORY_COLORS = {
  battles:  '#ef4444',   // red
  erv:      '#f97316',   // orange  (Explosions / Remote violence)
  vac:      '#8b5cf6',   // violet  (Violence against civilians)
};

const CATEGORY_LABELS = {
  battles: 'Battles',
  erv:     'Explosions/Remote violence',
  vac:     'Violence vs. civilians',
};

function severityClass(total) {
  if (total >= 100) return 'text-red-700 bg-red-100';
  if (total >= 40)  return 'text-orange-700 bg-orange-100';
  if (total >= 10)  return 'text-yellow-700 bg-yellow-100';
  return 'text-green-700 bg-green-100';
}

function TrendBar({ forecast, onClick, selected }) {
  const next = forecast.periods[0];
  if (!next) return null;
  const total = next.total_forecast;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900 truncate max-w-[140px]">
          {forecast.country}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${severityClass(total)}`}>
          {total.toFixed(0)} events
        </span>
      </div>
      {/* Mini stacked bar: visual proportion of categories */}
      <div className="mt-1.5 flex h-2 rounded-full overflow-hidden bg-gray-100">
        {total > 0 && (
          <>
            <div
              className="bg-red-400"
              style={{ width: `${(next.battles_forecast / total) * 100}%` }}
            />
            <div
              className="bg-orange-400"
              style={{ width: `${(next.erv_forecast / total) * 100}%` }}
            />
            <div
              className="bg-violet-400"
              style={{ width: `${(next.vac_forecast / total) * 100}%` }}
            />
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-400">{next.period_label}</p>
    </button>
  );
}

export default function CastForecastPanel({ forecasts = [] }) {
  const [selected, setSelected] = useState(null);

  if (!forecasts.length) {
    return (
      <div className="text-center py-6 text-sm text-gray-400">
        No CAST forecast data yet.
        <br />
        <span className="text-xs">Data syncs from ACLED weekly — check back after the first job run.</span>
      </div>
    );
  }

  // Group by country, keep all periods per country
  const byCountry = {};
  for (const f of forecasts) {
    (byCountry[f.country] = byCountry[f.country] || { country: f.country, periods: [] })
      .periods.push(f);
  }
  // Sort each country's periods chronologically
  for (const c of Object.values(byCountry)) {
    c.periods.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  }
  // Sort countries by nearest-period total_forecast descending
  const sorted = Object.values(byCountry).sort(
    (a, b) => (b.periods[0]?.total_forecast || 0) - (a.periods[0]?.total_forecast || 0)
  );

  const selectedData = selected ? byCountry[selected] : null;

  // Chart data: 6 periods for the selected country
  const chartData = (selectedData?.periods || []).map((p) => ({
    name: p.period_label,
    Battles:  parseFloat(p.battles_forecast.toFixed(1)),
    'Expl/RV': parseFloat(p.erv_forecast.toFixed(1)),
    'Viol/Civ': parseFloat(p.vac_forecast.toFixed(1)),
  }));

  return (
    <div className="space-y-3">
      {/* Source attribution */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Source:{' '}
          <a
            href="https://acleddata.com/platform/cast-conflict-alert-system"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            ACLED CAST
          </a>{' '}
          · rolling 4-week periods
        </p>
        <span className="text-xs text-gray-400">{sorted.length} countries</span>
      </div>

      {/* Country list */}
      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
        {sorted.map((c) => (
          <TrendBar
            key={c.country}
            forecast={c}
            selected={selected === c.country}
            onClick={() => setSelected(selected === c.country ? null : c.country)}
          />
        ))}
      </div>

      {/* Expanded 6-period chart for selected country */}
      {selectedData && chartData.length > 0 && (
        <div className="mt-3 bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-700 mb-2">
            {selectedData.country} — next {chartData.length} periods
          </p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip
                contentStyle={{ fontSize: 11 }}
                formatter={(v, name) => [v.toFixed(1), name]}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} />
              <Bar dataKey="Battles"   stackId="a" fill={CATEGORY_COLORS.battles} />
              <Bar dataKey="Expl/RV"   stackId="a" fill={CATEGORY_COLORS.erv} />
              <Bar dataKey="Viol/Civ"  stackId="a" fill={CATEGORY_COLORS.vac} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1 text-xs text-gray-500">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: CATEGORY_COLORS[key] }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
