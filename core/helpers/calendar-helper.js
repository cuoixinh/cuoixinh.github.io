// ============================================================
// CALENDAR-HELPER.JS - Mini calendar rendering
// ============================================================

const weddingDates = [
  { year: 2024, month: 10, day: 20 },
  { year: 2024, month: 10, day: 21 },
];

/**
 * Render mini calendar with marked wedding dates
 */
function renderMiniCalendar() {
  const container = document.getElementById("mini-calendar");
  if (!container) return;

  const { year, month } = weddingDates[0];
  const markedDays = weddingDates.map((d) => d.day);

  const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  let html = `
    <div style="font-family:'Inter',sans-serif;">
      <div style="text-align:center; font-size:14px; letter-spacing:2px; text-transform:uppercase; color:rgb(var(--card-sage-400-rgb)); font-weight:600; margin-bottom:12px;">
        Tháng ${month} · ${year}
      </div>
      <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-bottom:6px;">
        ${dayNames.map((d) => `<div style="text-align:center; font-size:11px; color:rgb(var(--card-sage-300-rgb)); padding:4px 0;">${d}</div>`).join("")}
      </div>
      <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px;">
        ${Array(firstDay).fill("<div></div>").join("")}
        ${Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const isMarked = markedDays.includes(day);
          return `<div style="display:flex; align-items:center; justify-content:center; height:36px;">
            <div style="
              width:32px; height:32px;
              display:flex; align-items:center; justify-content:center;
              border-radius:50%;
              font-size:12px;
              ${
                isMarked
                  ? "background:rgb(var(--card-gold-300-rgb)); color:white; font-weight:600; box-shadow:0 2px 8px var(--calendar-marked-glow);"
                  : "color:rgb(var(--card-charcoal-rgb));"
              }
            ">${day}</div>
          </div>`;
        }).join("")}
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function updateWeddingDates(dates) {
  weddingDates.length = 0;
  dates.forEach((d) => weddingDates.push(d));
}

// Make functions global
window.renderMiniCalendar = renderMiniCalendar;
window.updateWeddingDates = updateWeddingDates;
window.weddingDates = weddingDates;

// Render initial calendar
renderMiniCalendar();
