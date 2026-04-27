export function renderSparkline(values = [], { label = "trend", color = "#36f4ff" } = {}) {
  const safeValues = values.map((value) => Number(value) || 0);
  const width = 260;
  const height = 78;
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const range = Math.max(1, max - min);
  const points = safeValues.map((value, index) => {
    const x = safeValues.length <= 1 ? 0 : (index / (safeValues.length - 1)) * width;
    const y = height - (((value - min) / range) * (height - 10)) - 5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return `
    <svg class="admin-chart admin-chart--sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}">
      <path class="admin-chart__grid" d="M0 18H260 M0 39H260 M0 60H260"></path>
      <polyline class="admin-chart__line" style="--chart-color:${escapeHtml(color)}" points="${points}"></polyline>
      <circle class="admin-chart__last" style="--chart-color:${escapeHtml(color)}" cx="${safeValues.length <= 1 ? 0 : width}" cy="${safeValues.length ? (height - (((safeValues[safeValues.length - 1] - min) / range) * (height - 10)) - 5).toFixed(1) : height}" r="3"></circle>
    </svg>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderBarChart(items = [], { label = "bars" } = {}) {
  const max = Math.max(...items.map((item) => Number(item.value) || 0), 1);
  return `
    <div class="admin-bars" role="img" aria-label="${escapeHtml(label)}">
      ${items.map((item) => {
        const value = Number(item.value) || 0;
        const width = Math.max(4, Math.round((value / max) * 100));
        return `
          <div class="admin-bars__row">
            <span>${escapeHtml(item.label)}</span>
            <div class="admin-bars__track"><i style="width:${width}%;--bar-color:${escapeHtml(item.color || "#36f4ff")}"></i></div>
            <strong>${escapeHtml(String(value))}</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

export function renderDonut(items = [], { label = "distribution" } = {}) {
  const total = Math.max(1, items.reduce((sum, item) => sum + (Number(item.value) || 0), 0));
  let offset = 25;
  const segments = items.map((item) => {
    const value = Number(item.value) || 0;
    const dash = (value / total) * 75;
    const segment = `<circle r="15.9" cx="18" cy="18" style="--donut-color:${escapeHtml(item.color || "#36f4ff")};--donut-dash:${dash.toFixed(2)};--donut-offset:${offset.toFixed(2)}"></circle>`;
    offset -= dash;
    return segment;
  }).join("");

  return `
    <div class="admin-donut" role="img" aria-label="${escapeHtml(label)}">
      <svg viewBox="0 0 36 36">
        <circle class="admin-donut__base" r="15.9" cx="18" cy="18"></circle>
        ${segments}
      </svg>
      <div class="admin-donut__legend">
        ${items.map((item) => `<span><i style="background:${escapeHtml(item.color || "#36f4ff")}"></i>${escapeHtml(item.label)} ${escapeHtml(String(item.value))}%</span>`).join("")}
      </div>
    </div>
  `;
}
