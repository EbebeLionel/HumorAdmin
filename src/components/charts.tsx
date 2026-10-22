// Small dependency-free charts rendered on the server as HTML. Each mark shows a tooltip
// on hover/focus, and every chart has a table view so nothing relies on color alone.

export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value)!;
  return step * magnitude;
}

function compact(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}K` : String(value);
}

type TableProps = { headers: string[]; rows: (string | number)[][] };

export function TableView({ headers, rows }: TableProps) {
  return (
    <details className="table-view">
      <summary>Show as table</summary>
      <table className="table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

type Column = { key: string; label: string; value: number; tip: string };

// Vertical columns for a single series over an ordered axis (days, hours)
export function ColumnChart({
  data,
  label,
  labelEvery = 1,
  max,
}: {
  data: Column[];
  label: string;
  labelEvery?: number;
  max?: number;
}) {
  const top = max ?? niceMax(Math.max(0, ...data.map((d) => d.value)));
  const peak = data.reduce((best, d) => (d.value > best.value ? d : best), data[0]);

  return (
    <div className="col-chart" role="group" aria-label={label}>
      <div className="col-grid">
        <span className="col-tick" style={{ bottom: "100%" }}>{compact(top)}</span>
        <span className="col-tick" style={{ bottom: "50%" }}>{compact(top / 2)}</span>
        <span className="col-tick" style={{ bottom: "0%" }}>0</span>
        <div className="cols">
          {data.map((d) => (
            <div key={d.key} className="col" tabIndex={0} aria-label={d.tip}>
              <span className="col-bar" style={{ height: `${(d.value / top) * 100}%` }}>
                {peak && d.key === peak.key && d.value > 0 && <span className="col-cap">{d.value}</span>}
              </span>
              <span className="tip" role="tooltip">{d.tip}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="col-labels" aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.key}>{i % labelEvery === 0 ? d.label : ""}</span>
        ))}
      </div>
    </div>
  );
}

type Bar = { key: string; label: string; value: number; display: string; tip: string };

// Horizontal bars for comparing categories; value printed at the bar's tip
export function BarList({ data, max }: { data: Bar[]; max?: number }) {
  const top = max ?? Math.max(0, ...data.map((d) => d.value)) ?? 1;

  return (
    <ul className="bar-list">
      {data.map((d) => (
        <li key={d.key} className="bar-row" tabIndex={0} aria-label={d.tip}>
          <span className="bar-label">{d.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${top ? (d.value / top) * 100 : 0}%` }} />
            <span className="bar-value">{d.display}</span>
          </span>
          <span className="tip" role="tooltip">{d.tip}</span>
        </li>
      ))}
    </ul>
  );
}

// Funny (blue) vs not funny (red) split for one caption
export function VoteSplit({ up, down }: { up: number; down: number }) {
  const total = up + down;
  if (!total) return <span className="muted small">No votes</span>;
  return (
    <span className="split" role="img" aria-label={`${up} funny, ${down} not funny`} title={`${up} funny · ${down} not funny`}>
      {up > 0 && <span className="split-up" style={{ flexGrow: up }} />}
      {down > 0 && <span className="split-down" style={{ flexGrow: down }} />}
    </span>
  );
}

export function SplitLegend() {
  return (
    <span className="legend">
      <span><i className="swatch swatch-up" /> Funny</span>
      <span><i className="swatch swatch-down" /> Not funny</span>
    </span>
  );
}
