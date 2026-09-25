const DATA_URL = "../data/project_life_satisfaction.csv";
const WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const MAX_SELECTED = 8;
const YEARS_WITH_GAP = [2013];
const DEFAULT_YEAR = 2025;
const INCOME_GROUPS = [
  { id: "High", label: "High income" },
  { id: "Upper middle", label: "Upper-middle income" },
  { id: "Lower middle", label: "Lower-middle income" },
  { id: "Low", label: "Low income" },
];

const state = {
  year: DEFAULT_YEAR,
  incomes: new Set(INCOME_GROUPS.map((item) => item.id)),
  selected: new Set(),
  selectedContinents: new Set(),
  hover: null,
  search: "",
  sort: "score-desc",
  type: "countries",
  rows: [],
  byIso: new Map(),
  years: [],
  land: null,
  positions: new Map(),
  timer: null,
  tween: null,
  t: DEFAULT_YEAR,
  scrollTo: null,
};

const gdpState = {
  year: DEFAULT_YEAR,
  t: DEFAULT_YEAR,
  timer: null,
  tween: null,
};
const GDP_YEAR_MS = 1150;
const MAP_YEAR_MS = 1150;

const tooltip = d3.select("#project-tooltip");

function formatScore(value) {
  return value == null || Number.isNaN(value) ? "—" : d3.format(".2f")(value);
}

function formatPop(value) {
  if (value == null) return "—";
  if (value >= 1e9) return d3.format(".2f")(value / 1e9) + " billion";
  if (value >= 1e6) return d3.format(".1f")(value / 1e6) + " million";
  return d3.format(",")(value);
}

function formatChange(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return (value > 0 ? "+" : "") + d3.format(".2f")(value);
}

function formatGdp(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return d3.format("$,.0f")(value);
}

function formatGdpTick(value) {
  return "$" + d3.format("~s")(value).replace("G", "B");
}

function syncPlayUi() {
  const playing = Boolean(state.timer);
  d3.selectAll(".change-year-toggle")
    .attr("aria-label", playing ? "Pause years" : "Play years")
    .classed("is-playing", playing);
}

function stopTween() {
  if (state.tween) state.tween.stop();
  state.tween = null;
}

function currentT() {
  return state.t == null ? state.year : state.t;
}

function displayYear(t) {
  const years = state.years;
  if (!years.length) return Math.round(t);
  let year = years[0];
  years.forEach((item) => {
    if (item <= t + 1e-6) year = item;
  });
  return year;
}

function startTimer() {
  if (state.timer) return;
  stopTween();
  state.t = currentT();
  let last = performance.now();
  const first = state.years[0];
  const finalYear = state.years[state.years.length - 1];
  state.timer = d3.timer(() => {
    const now = performance.now();
    state.t += (now - last) / MAP_YEAR_MS;
    last = now;
    if (state.t > finalYear) state.t = first;
    const nextYear = displayYear(state.t);
    const yearChanged = nextYear !== state.year;
    state.year = nextYear;
    syncYearControls(state.year);
    renderAll({ notesOnly: !yearChanged, skipGdp: true });
  });
  syncPlayUi();
}

function stopTimer() {
  if (state.timer) state.timer.stop();
  state.timer = null;
  stopTween();
  syncPlayUi();
}

function toggleTimer() {
  if (state.timer) stopTimer();
  else startTimer();
}

function nearestYears(t) {
  const years = state.years;
  if (!years.length) return [DEFAULT_YEAR, DEFAULT_YEAR, 0];
  if (t <= years[0]) return [years[0], years[0], 0];
  if (t >= years[years.length - 1]) return [years[years.length - 1], years[years.length - 1], 0];
  let index = 0;
  while (index < years.length - 1 && years[index + 1] <= t) index += 1;
  const start = years[index];
  const end = years[Math.min(index + 1, years.length - 1)];
  if (start === end) return [start, end, 0];
  return [start, end, (t - start) / (end - start)];
}

function interpolateRow(a, b, u, t) {
  const src = b || a;
  const first = firstRecord(src.iso);
  const happiness = lerp(a?.happiness, b?.happiness, u);
  const population = lerp(a?.population, b?.population, u);
  return {
    ...src,
    happiness,
    population,
    year: t,
    baseYear: first ? first.year : null,
    change: first && happiness != null ? happiness - first.happiness : null,
  };
}

function rowsAt(t) {
  const [yearA, yearB, u] = nearestYears(t);
  const mapA = new Map(state.rows.filter((row) => row.year === yearA).map((row) => [row.iso, row]));
  const mapB = new Map(state.rows.filter((row) => row.year === yearB).map((row) => [row.iso, row]));
  const items = [];
  new Set([...mapA.keys(), ...mapB.keys()]).forEach((iso) => {
    const row = interpolateRow(mapA.get(iso), mapB.get(iso), u, t);
    if (row.happiness == null) return;
    items.push(row);
  });
  return items;
}

function visibleRows() {
  return state.rows.filter((row) => row.year === state.year);
}

function liveRows() {
  return enrich(rowsAt(currentT()));
}

function incomeActive() {
  return state.incomes.size > 0 && state.incomes.size < INCOME_GROUPS.length;
}

function isIncomeOn(group) {
  return !incomeActive() || state.incomes.has(group);
}

function activeRows() {
  return visibleRows().filter((row) => isIncomeOn(row.income_group));
}

function firstRecord(iso) {
  return (state.byIso.get(iso) || [])[0] || null;
}

function syncYearControls(year) {
  d3.selectAll("#year-slider, .note-year-slider").property("value", year);
  d3.select("#year-readout").text(year);
  d3.selectAll(".note-year-readout").text(year);
}

function setYear(year, options) {
  year = +year;
  if (YEARS_WITH_GAP.includes(year)) year = 2014;
  const animateNotes = !options || options.animate !== false;
  const from = currentT();
  state.year = year;
  syncYearControls(year);
  stopTween();
  if (!animateNotes || Math.abs(from - year) < 0.02) {
    state.t = year;
    renderAll();
    return;
  }
  renderAll({ mapOnly: true });
  const duration = Math.min(900, 260 + Math.abs(year - from) * 160);
  const started = performance.now();
  state.tween = d3.timer(() => {
    const u = Math.min(1, (performance.now() - started) / duration);
    state.t = from + (year - from) * d3.easeCubicInOut(u);
    renderAll({ notesOnly: true });
    if (u >= 1) {
      stopTween();
      state.t = year;
      renderAll({ notesOnly: true });
    }
  });
}

function enrich(rows) {
  const ranked = rows.slice().sort((a, b) => d3.descending(a.happiness, b.happiness));
  ranked.forEach((row, index) => {
    row.rank = index + 1;
    const first = firstRecord(row.iso);
    row.baseYear = first ? first.year : null;
    row.change = first ? row.happiness - first.happiness : null;
  });
  return rows;
}

function continentRows(yearRows) {
  return Array.from(d3.group(yearRows, (d) => d.continent))
    .filter(([name]) => name && name !== "Other")
    .map(([name, members]) => {
      const happiness = d3.mean(members, (d) => d.happiness);
      const firstYearRows = state.rows.filter((row) => row.continent === name && row.year === state.years[0]);
      const firstMean = d3.mean(firstYearRows, (d) => d.happiness);
      return {
        country: name,
        iso: name,
        continent: name,
        happiness,
        population: d3.sum(members, (d) => d.population),
        income_group: "Continent average",
        rank: null,
        change: firstMean == null ? null : happiness - firstMean,
        baseYear: state.years[0],
        year: state.year,
        kind: "continent",
        members,
      };
    });
}

function continentSeries(name) {
  return state.years.map((year) => {
    const members = state.rows.filter((row) => row.year === year && row.continent === name);
    return {
      year,
      happiness: d3.mean(members, (d) => d.happiness),
      country: name,
      iso: name,
    };
  }).filter((row) => row.happiness != null);
}

function colorScale(rows) {
  const mean = d3.mean(rows, (d) => d.happiness);
  const extent = d3.extent(rows, (d) => d.happiness);
  return d3.scaleLinear()
    .domain([extent[0], mean, extent[1]])
    .range(["#2c7bb6", "#f4f1e9", "#d7191c"])
    .clamp(true);
}

function radiusScale(rows) {
  return d3.scaleSqrt()
    .domain(d3.extent(rows, (d) => d.population))
    .range([4, 30]);
}

function setStatus(text) {
  d3.select("#project-status").text(text);
}

function showTooltip(event, row, mean) {
  tooltip
    .style("opacity", 1)
    .html(
      `<strong>${row.country}</strong><br>` +
      `Score ${formatScore(row.happiness)}` +
      (row.rank ? ` · rank ${row.rank} of ${visibleRows().length}` : "") +
      `<br>Population ${formatPop(row.population)}<br>` +
      (row.gdp != null ? `GDP per capita ${formatGdp(row.gdp)}<br>` : "") +
      `${row.kind === "continent" ? "Continent average" : `Income ${row.income_group}`}<br>` +
      `Change since ${row.baseYear} ${formatChange(row.change)}<br>` +
      `Year average ${formatScore(mean)}`
    )
    .style("left", `${event.pageX + 12}px`)
    .style("top", `${event.pageY + 12}px`);
}

function hideTooltip() {
  tooltip.style("opacity", 0);
}

function toggleSelect(iso) {
  if (state.selected.has(iso)) state.selected.delete(iso);
  else if (state.selected.size < MAX_SELECTED) state.selected.add(iso);
  state.scrollTo = iso;
  renderAll();
}

function toggleContinent(name) {
  if (state.selectedContinents.has(name)) state.selectedContinents.delete(name);
  else state.selectedContinents.add(name);
  state.scrollTo = name;
  renderAll();
}

function isSelectedEntity(item) {
  return item.kind === "continent"
    ? state.selectedContinents.has(item.iso)
    : state.selected.has(item.iso);
}

function setListOpen(open) {
  const panel = document.getElementById("entity-panel");
  if (!panel) return;
  panel.hidden = !open;
  d3.select(".map-stage").classed("is-list-open", open);
  d3.select("#toggle-list")
    .text(open ? "Hide list" : "Show list")
    .attr("aria-expanded", open);
}

const FLOAT_PANELS = ["rank-panel", "change-panel", "traj-panel"];
const floatState = {
  order: [],
  pos: new Map(),
};

function floatBuoy(id) {
  return document.querySelector(`.map-buoy[aria-controls="${id}"]`);
}

function applyFloatLayout(id) {
  const el = document.getElementById(id);
  if (!el || el.hidden) return;
  const dragged = floatState.pos.get(id);
  const index = Math.max(floatState.order.indexOf(id), 0);
  if (dragged) {
    el.style.left = `${dragged.left}px`;
    el.style.top = `${dragged.top}px`;
    el.style.bottom = "auto";
  } else {
    el.style.left = `${12 + index * 16}px`;
    el.style.bottom = `${12 + index * 16}px`;
    el.style.top = "auto";
  }
  el.style.zIndex = 11 + index;
}

function setFloatOpen(id, open) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = !open;
  const buoy = floatBuoy(id);
  if (buoy) {
    buoy.classList.toggle("is-open", open);
    buoy.setAttribute("aria-expanded", open);
  }
  if (open) {
    if (!floatState.order.includes(id)) floatState.order.push(id);
  } else {
    floatState.order = floatState.order.filter((item) => item !== id);
    floatState.pos.delete(id);
    el.style.left = "";
    el.style.top = "";
    el.style.bottom = "";
  }
  floatState.order.forEach(applyFloatLayout);
  if (open) renderAll();
}

function closeAllFloats() {
  FLOAT_PANELS.forEach((id) => setFloatOpen(id, false));
}

function bindFloatDrag(id) {
  const el = document.getElementById(id);
  const head = el && el.querySelector(".float-card-head");
  if (!head) return;
  let start = null;
  head.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    const stage = document.querySelector(".map-stage").getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    start = {
      x: event.clientX,
      y: event.clientY,
      left: rect.left - stage.left,
      top: rect.top - stage.top,
    };
    floatState.order = floatState.order.filter((item) => item !== id).concat(id);
    el.classList.add("is-dragging");
    applyFloatLayout(id);
    head.setPointerCapture(event.pointerId);
  });
  head.addEventListener("pointermove", (event) => {
    if (!start) return;
    const stage = document.querySelector(".map-stage").getBoundingClientRect();
    let left = start.left + (event.clientX - start.x);
    let top = start.top + (event.clientY - start.y);
    left = Math.max(8, Math.min(left, stage.width - el.offsetWidth - 8));
    top = Math.max(8, Math.min(top, stage.height - el.offsetHeight - 8));
    floatState.pos.set(id, { left, top });
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.bottom = "auto";
  });
  const endDrag = () => {
    start = null;
    el.classList.remove("is-dragging");
  };
  head.addEventListener("pointerup", endDrag);
  head.addEventListener("pointercancel", endDrag);
}

function clearSelection() {
  state.selected.clear();
  state.selectedContinents.clear();
  state.hover = null;
  hideTooltip();
  renderAll();
}

function resetView() {
  stopTimer();
  state.year = state.years.includes(DEFAULT_YEAR) ? DEFAULT_YEAR : state.years[state.years.length - 1];
  state.t = state.year;
  stopTween();
  state.incomes = new Set(INCOME_GROUPS.map((item) => item.id));
  state.selected.clear();
  state.selectedContinents.clear();
  state.hover = null;
  state.search = "";
  state.sort = "score-desc";
  state.type = "countries";
  state.scrollTo = null;
  syncYearControls(state.year);
  d3.select("#entity-search").property("value", "");
  d3.select("#entity-sort").property("value", "score-desc");
  d3.select("#entity-type").property("value", "countries");
  setListOpen(false);
  closeAllFloats();
  hideTooltip();
  renderAll();
}

function chartSize(selector, fallbackHeight) {
  const node = document.querySelector(selector);
  const width = Math.max(node.getBoundingClientRect().width, 240);
  return { width, height: fallbackHeight };
}

function updateSummary(rows, mean) {
  d3.select("#summary-year").text(state.year);
  d3.select("#year-readout").text(state.year);
  d3.select("#summary-count").text(rows.length);
  d3.select("#summary-mean").text(formatScore(mean));
  const incomeLabel = !incomeActive()
    ? "All"
    : INCOME_GROUPS.filter((item) => state.incomes.has(item.id)).map((item) => item.label.replace(" income", "")).join(", ");
  d3.select("#summary-income").text(incomeLabel);
  const selected = [
    ...visibleRows().filter((row) => state.selected.has(row.iso)).map((row) => row.country),
    ...state.selectedContinents,
  ];
  d3.select("#summary-selected").text(selected.length ? selected.join(", ") : "None");
}

function drawIncomePills(yearRows) {
  const means = d3.rollup(yearRows, (values) => d3.mean(values, (d) => d.happiness), (d) => d.income_group);
  const pills = d3.select("#income-pills").selectAll("button").data(INCOME_GROUPS, (d) => d.id);
  const joined = pills.join("button")
    .attr("type", "button")
    .attr("class", "income-pill")
    .classed("is-on", (d) => isIncomeOn(d.id))
    .on("click", (_, item) => {
      if (state.incomes.has(item.id)) state.incomes.delete(item.id);
      else state.incomes.add(item.id);
      renderAll();
    });
  joined.html((d) =>
    `<span>${d.label}</span><strong>${formatScore(means.get(d.id))} avg</strong>`
  );
}

function drawColorLegend(scale, rows) {
  const { width } = chartSize("#color-legend", 18);
  const height = 14;
  const mean = d3.mean(rows, (d) => d.happiness);
  const extent = d3.extent(rows, (d) => d.happiness);
  const x = d3.scaleLinear().domain(extent).range([0, width]);
  const svg = d3.select("#color-legend").selectAll("svg").data([null]);
  const root = svg.enter().append("svg").merge(svg).attr("viewBox", `0 0 ${width} ${height}`);
  root.selectAll("*").remove();
  const grad = root.append("defs").append("linearGradient").attr("id", "happiness-gradient");
  d3.range(0, 1.01, 0.08).forEach((t) => {
    grad.append("stop").attr("offset", `${t * 100}%`).attr("stop-color", scale(x.invert(t * width)));
  });
  root.append("rect").attr("width", width).attr("height", height).attr("fill", "url(#happiness-gradient)");
  root.append("line")
    .attr("x1", x(mean)).attr("x2", x(mean))
    .attr("y1", 0).attr("y2", height)
    .attr("stroke", "#17211d");
}

function drawSizeLegend(radius) {
  const pops = [1e6, 2e6, 5e6, 1e7, 2e7, 5e7, 1e8, 2e8, 5e8];
  const labeled = new Map([[5e6, "5M"], [5e7, "50M"], [5e8, "500M"]]);
  const legendR = (pop) => radius(pop) * 0.48;
  const maxR = legendR(5e8);
  const gap = 2;
  const pad = 2;
  const items = [];
  let cx = pad;
  pops.forEach((pop) => {
    const r = legendR(pop);
    cx += r;
    items.push({ pop, r, cx, label: labeled.get(pop) || null });
    cx += r + gap;
  });
  const width = Math.max(cx, 200);
  const height = maxR * 2 + 16;
  const baseline = maxR + 1;
  const svg = d3.select("#size-legend").selectAll("svg").data([null]);
  const root = svg.enter().append("svg").merge(svg).attr("viewBox", `0 0 ${width} ${height}`);
  root.selectAll("*").remove();
  items.forEach((item) => {
    root.append("circle")
      .attr("cx", item.cx)
      .attr("cy", baseline)
      .attr("r", item.r)
      .attr("fill", "none")
      .attr("stroke", "#17211d");
    if (item.label) {
      root.append("text")
        .attr("x", item.cx)
        .attr("y", baseline + maxR + 10)
        .attr("text-anchor", "middle")
        .attr("fill", "#65706b")
        .attr("font-size", 11)
        .text(item.label);
    }
  });
}

function drawDorling(rows, color, radius, mean, options) {
  const { width, height } = chartSize("#dorling-map", 520);
  const svg = d3.select("#dorling-map").selectAll("svg").data([null]);
  const root = svg.enter().append("svg").merge(svg)
    .attr("viewBox", `0 0 ${width} ${height}`);
  if (root.select("g.land").empty()) {
    root.append("g").attr("class", "land");
    root.append("g").attr("class", "countries");
  }

  const projection = d3.geoNaturalEarth1().fitExtent([[10, 8], [width - 10, height - 8]], { type: "Sphere" });
  const path = d3.geoPath(projection);
  root.select("g.land").selectAll("path").data(state.land ? [state.land] : [])
    .join("path")
    .attr("d", path)
    .attr("fill", "#e4ddd0")
    .attr("stroke", "none")
    .style("pointer-events", "none");

  const nodes = rows.map((row) => {
    const point = projection([row.lon, row.lat]) || [width / 2, height / 2];
    const prev = state.positions.get(row.iso);
    return {
      ...row,
      tx: point[0],
      ty: point[1],
      r: radius(row.population),
      x: prev ? prev.x : point[0],
      y: prev ? prev.y : point[1],
    };
  });

  const simulation = d3.forceSimulation(nodes)
    .force("x", d3.forceX((d) => d.tx).strength(0.16))
    .force("y", d3.forceY((d) => d.ty).strength(0.16))
    .force("collide", d3.forceCollide((d) => d.r + 1.15).iterations(3))
    .stop();
  const ticks = options && options.light ? 16 : 140;
  for (let i = 0; i < ticks; i += 1) simulation.tick();
  nodes.forEach((node) => state.positions.set(node.iso, { x: node.x, y: node.y }));

  const faded = visibleRows()
    .filter((row) => !isIncomeOn(row.income_group))
    .map((row) => {
      const point = projection([row.lon, row.lat]) || [width / 2, height / 2];
      const prev = state.positions.get(row.iso) || { x: point[0], y: point[1] };
      return { ...row, x: prev.x, y: prev.y, r: radius(row.population), faded: true };
    });
  const drawRows = nodes.concat(faded);

  root.select("g.countries").selectAll("circle").data(drawRows, (d) => d.iso)
    .join(
      (enter) => enter.append("circle").attr("class", "country-dot"),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("r", (d) => d.r)
    .attr("fill", (d) => color(d.happiness))
    .attr("fill-opacity", (d) => (d.faded ? 0.1 : 0.92))
    .attr("stroke", (d) => {
      if (state.selected.has(d.iso)) return "#17211d";
      if (state.selectedContinents.has(d.continent)) return "#3b6755";
      if (state.hover === d.iso) return "#e8582a";
      return "rgba(23,33,29,.28)";
    })
    .attr("stroke-width", (d) => (
      state.selected.has(d.iso) || state.hover === d.iso || state.selectedContinents.has(d.continent) ? 2 : 0.7
    ))
    .style("cursor", "pointer")
    .on("mousemove", (event, d) => {
      state.hover = d.iso;
      showTooltip(event, d, mean);
      highlight(d.iso);
    })
    .on("mouseleave", () => {
      state.hover = null;
      hideTooltip();
      highlight(null);
    })
    .on("click", (_, d) => toggleSelect(d.iso));
}

function sortEntities(items) {
  const copy = items.slice();
  if (state.sort === "score-asc") copy.sort((a, b) => d3.ascending(a.happiness, b.happiness));
  else if (state.sort === "name") copy.sort((a, b) => d3.ascending(a.country, b.country));
  else copy.sort((a, b) => d3.descending(a.happiness, b.happiness));
  return copy;
}

function drawEntityList(yearRows, color, mean) {
  const source = state.type === "continents"
    ? continentRows(yearRows)
    : yearRows.filter((row) => isIncomeOn(row.income_group));
  const query = state.search.trim().toLowerCase();
  const items = sortEntities(source.filter((row) => row.country.toLowerCase().includes(query)));

  const list = d3.select("#entity-list").selectAll("button.entity-row").data(items, (d) => d.iso);
  const row = list.join(
    (enter) => {
      const button = enter.append("button").attr("type", "button").attr("class", "entity-row");
      button.append("span").attr("class", "entity-name");
      button.append("span").attr("class", "entity-track").append("span").attr("class", "entity-bar");
      button.append("span").attr("class", "entity-score");
      return button;
    },
    (update) => update,
    (exit) => exit.remove()
  );

  row
    .classed("is-selected", (d) => isSelectedEntity(d))
    .classed("is-hover", (d) => state.hover === d.iso)
    .on("mousemove", (event, d) => {
      state.hover = d.iso;
      showTooltip(event, d, mean);
      highlight(d.iso);
    })
    .on("mouseleave", () => {
      state.hover = null;
      hideTooltip();
      highlight(null);
    })
    .on("click", (_, d) => {
      if (d.kind === "continent") toggleContinent(d.iso);
      else toggleSelect(d.iso);
    });

  row.select(".entity-name").text((d) => d.country);
  row.select(".entity-bar")
    .style("width", (d) => `${Math.max((d.happiness / 10) * 100, 2)}%`)
    .style("background", (d) => color(d.happiness));
  row.select(".entity-score").text((d) => formatScore(d.happiness));

  if (state.scrollTo) {
    const listPanel = document.getElementById("entity-panel");
    if (listPanel && !listPanel.hidden) {
      const node = row.filter((d) => d.iso === state.scrollTo).node();
      if (node) node.scrollIntoView({ block: "nearest" });
    }
    state.scrollTo = null;
  }
}

function selectedRankItems(yearRows) {
  const countries = yearRows.filter((row) => state.selected.has(row.iso));
  const continents = continentRows(yearRows).filter((row) => state.selectedContinents.has(row.iso));
  return countries.concat(continents)
    .filter((row) => row.happiness != null)
    .sort((a, b) => d3.descending(a.happiness, b.happiness) || d3.ascending(a.country, b.country));
}

function drawRank(yearRows, color, mean) {
  const chart = document.getElementById("rank-chart");
  if (!chart || document.getElementById("rank-panel").hidden) return;
  const items = selectedRankItems(yearRows);
  const { width } = chartSize("#rank-chart", 220);
  const rowH = 28;
  const margin = { top: 8, right: 16, bottom: 28, left: 108 };
  const height = items.length ? margin.top + margin.bottom + items.length * rowH : 84;
  const svg = d3.select("#rank-chart").selectAll("svg").data([null]);
  const root = svg.enter().append("svg").merge(svg).attr("viewBox", `0 0 ${width} ${height}`);
  root.selectAll("*").remove();

  if (!items.length) {
    root.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#65706b")
      .attr("font-size", 12)
      .text("Select a country or continent.");
    return;
  }

  const x = d3.scaleLinear().domain([0, 10]).range([margin.left, width - margin.right]);
  root.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5).tickSizeInner(4).tickSizeOuter(0))
    .call((g) => g.select(".domain").attr("stroke", "#c8c1b4"))
    .call((g) => g.selectAll("text").attr("fill", "#65706b"));
  root.append("line")
    .attr("x1", x(mean)).attr("x2", x(mean))
    .attr("y1", margin.top).attr("y2", height - margin.bottom)
    .attr("stroke", "#65706b").attr("stroke-dasharray", "3 3");

  const groups = root.selectAll("g.bar-row").data(items, (d) => d.iso).join("g").attr("class", "bar-row")
    .attr("transform", (_, i) => `translate(0,${margin.top + i * rowH})`);
  groups.append("text")
    .attr("x", margin.left - 8).attr("y", 16).attr("text-anchor", "end")
    .attr("fill", "#17211d").attr("font-size", 11)
    .text((d) => d.country);
  groups.append("rect")
    .attr("x", x(0)).attr("y", 6)
    .attr("width", (d) => Math.max(x(d.happiness) - x(0), 0))
    .attr("height", 12)
    .attr("fill", (d) => color(d.happiness))
    .attr("stroke", (d) => (isSelectedEntity(d) || state.hover === d.iso ? "#17211d" : "none"))
    .style("cursor", "pointer")
    .on("mousemove", (event, d) => {
      state.hover = d.iso;
      showTooltip(event, d, mean);
      highlight(d.iso);
    })
    .on("mouseleave", () => {
      state.hover = null;
      hideTooltip();
      highlight(null);
    })
    .on("click", (_, d) => {
      if (d.kind === "continent") toggleContinent(d.iso);
      else toggleSelect(d.iso);
    });
  groups.append("text")
    .attr("x", (d) => x(d.happiness) + 6).attr("y", 16)
    .attr("fill", "#65706b").attr("font-size", 11)
    .text((d) => formatScore(d.happiness));
}

function drawChange(rows, color, radius, mean) {
  if (document.getElementById("change-panel").hidden) return;
  const items = rows.filter((row) => row.change != null);
  const { width } = chartSize("#change-chart", 220);
  const height = 220;
  const margin = { top: 18, right: 10, bottom: 28, left: 36 };
  const svg = d3.select("#change-chart").selectAll("svg").data([null]);
  const root = svg.enter().append("svg").merge(svg).attr("viewBox", `0 0 ${width} ${height}`);
  root.selectAll("*").remove();

  const x = d3.scaleLinear().domain([1, 8.2]).range([margin.left, width - margin.right]);
  const yExtent = d3.extent(items, (d) => d.change);
  const y = d3.scaleLinear()
    .domain([(yExtent[0] ?? -1) - 0.2, (yExtent[1] ?? 1) + 0.2])
    .range([height - margin.bottom, margin.top]);

  root.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(5).tickSizeOuter(0))
    .call((g) => g.select(".domain").attr("stroke", "#c8c1b4"))
    .call((g) => g.selectAll("text").attr("fill", "#65706b"));
  root.append("g").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSizeOuter(0))
    .call((g) => g.select(".domain").attr("stroke", "#c8c1b4"))
    .call((g) => g.selectAll("text").attr("fill", "#65706b"));
  root.append("text").attr("x", width - margin.right).attr("y", height - 6)
    .attr("text-anchor", "end").attr("fill", "#65706b").attr("font-size", 10)
    .text("Current score");
  root.append("line").attr("x1", margin.left).attr("x2", width - margin.right)
    .attr("y1", y(0)).attr("y2", y(0)).attr("stroke", "#65706b").attr("stroke-dasharray", "3 3");
  root.append("line").attr("x1", x(mean)).attr("x2", x(mean))
    .attr("y1", margin.top).attr("y2", height - margin.bottom)
    .attr("stroke", "#65706b").attr("stroke-dasharray", "3 3");

  root.selectAll("circle").data(items, (d) => d.iso).join("circle")
    .attr("cx", (d) => x(d.happiness))
    .attr("cy", (d) => y(d.change))
    .attr("r", (d) => Math.max(3, radius(d.population) * 0.4))
    .attr("fill", (d) => color(d.happiness))
    .attr("fill-opacity", (d) => (state.selected.size && !state.selected.has(d.iso) ? 0.14 : 0.88))
    .attr("stroke", (d) => (state.selected.has(d.iso) || state.hover === d.iso ? "#17211d" : "rgba(23,33,29,.25)"))
    .style("cursor", "pointer")
    .on("mousemove", (event, d) => {
      state.hover = d.iso;
      showTooltip(event, d, mean);
      highlight(d.iso);
    })
    .on("mouseleave", () => {
      state.hover = null;
      hideTooltip();
      highlight(null);
    })
    .on("click", (_, d) => toggleSelect(d.iso));
}

function trajectoryTicks(endYear) {
  const start = state.years[0] || 2011;
  const ticks = [start];
  [2015, 2020, 2025].forEach((year) => {
    if (year > start && year <= endYear + 1e-6) ticks.push(year);
  });
  return ticks;
}

function seriesThrough(iso, name, t) {
  const raw = (state.byIso.get(iso) || []).filter((d) => d.happiness != null && d.year <= t);
  const [yearA, yearB, u] = nearestYears(t);
  if (yearA !== yearB && t > yearA) {
    const a = (state.byIso.get(iso) || []).find((d) => d.year === yearA);
    const b = (state.byIso.get(iso) || []).find((d) => d.year === yearB);
    const happiness = lerp(a?.happiness, b?.happiness, u);
    if (happiness != null) {
      raw.push({
        year: t,
        happiness,
        country: name,
        iso,
      });
    }
  }
  return raw;
}

function continentSeriesThrough(name, t) {
  const full = continentSeries(name);
  const raw = full.filter((d) => d.year <= t);
  const [yearA, yearB, u] = nearestYears(t);
  if (yearA !== yearB && t > yearA) {
    const a = full.find((d) => d.year === yearA);
    const b = full.find((d) => d.year === yearB);
    const happiness = lerp(a?.happiness, b?.happiness, u);
    if (happiness != null) {
      raw.push({
        year: t,
        happiness,
        country: name,
        iso: name,
      });
    }
  }
  return raw;
}

function drawTrajectories(mean) {
  if (document.getElementById("traj-panel").hidden) return;
  const { width } = chartSize("#trajectory-chart", 220);
  const height = 220;
  const margin = { top: 16, right: 88, bottom: 28, left: 30 };
  const svg = d3.select("#trajectory-chart").selectAll("svg").data([null]);
  const root = svg.enter().append("svg").merge(svg).attr("viewBox", `0 0 ${width} ${height}`);
  root.selectAll("*").remove();

  const startYear = state.years[0] || 2011;
  const endYear = currentT();
  const xMax = endYear <= startYear ? startYear + 1 : endYear;
  const x = d3.scaleLinear().domain([startYear, xMax]).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([1, 8.2]).range([height - margin.bottom, margin.top]);
  root.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues(trajectoryTicks(endYear)).tickFormat(d3.format("d")).tickSizeOuter(0))
    .call((g) => g.select(".domain").attr("stroke", "#c8c1b4"))
    .call((g) => g.selectAll("text").attr("fill", "#65706b"));
  root.append("g").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSizeOuter(0))
    .call((g) => g.select(".domain").attr("stroke", "#c8c1b4"))
    .call((g) => g.selectAll("text").attr("fill", "#65706b"));
  root.append("line").attr("x1", margin.left).attr("x2", width - margin.right)
    .attr("y1", y(mean)).attr("y2", y(mean))
    .attr("stroke", "#65706b").attr("stroke-dasharray", "3 3");

  const selected = [
    ...Array.from(state.selected).map((iso) => ({
      iso,
      name: (state.byIso.get(iso) || [])[0]?.country || iso,
      series: seriesThrough(iso, (state.byIso.get(iso) || [])[0]?.country || iso, endYear),
    })),
    ...Array.from(state.selectedContinents).map((name) => ({
      iso: name,
      name,
      series: continentSeriesThrough(name, endYear),
    })),
  ].filter((item) => item.series.length);

  if (!selected.length) {
    root.append("text")
      .attr("x", (width + margin.left - margin.right) / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#65706b")
      .attr("font-size", 12)
      .text("Select a country or continent.");
    return;
  }

  const line = d3.line().x((d) => x(d.year)).y((d) => y(d.happiness));
  const palette = d3.schemeTableau10;
  selected.forEach((item, index) => {
    const color = palette[index % palette.length];
    root.append("path")
      .datum(item.series)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", item.iso === state.hover ? 3 : 2)
      .attr("d", line);
    const last = item.series.find((d) => d.year === endYear) || item.series[item.series.length - 1];
    root.append("circle")
      .attr("cx", x(last.year)).attr("cy", y(last.happiness)).attr("r", 3.5)
      .attr("fill", color).attr("stroke", "#17211d");
    root.append("text")
      .attr("x", x(last.year) + 6).attr("y", y(last.happiness) + 3)
      .attr("fill", "#17211d").attr("font-size", 10)
      .text(item.name);
  });
}

function gdpRows(year) {
  return state.rows.filter((row) => (
    row.year === year && row.gdp > 0 && row.happiness != null && row.population > 0
  ));
}

function lerp(a, b, u) {
  if (a == null || Number.isNaN(a)) return b;
  if (b == null || Number.isNaN(b)) return a;
  return a + (b - a) * u;
}

function nearestGdpYears(t) {
  return nearestYears(t);
}

function displayGdpYear(t) {
  let year = Math.round(t);
  if (YEARS_WITH_GAP.includes(year)) year = t < 2013 ? 2012 : 2014;
  return year;
}

function gdpItemsAt(t) {
  const [yearA, yearB, u] = nearestGdpYears(t);
  const mapA = new Map(gdpRows(yearA).map((row) => [row.iso, row]));
  const mapB = new Map(gdpRows(yearB).map((row) => [row.iso, row]));
  const items = [];
  new Set([...mapA.keys(), ...mapB.keys()]).forEach((iso) => {
    const a = mapA.get(iso);
    const b = mapB.get(iso);
    const src = b || a;
    const gdp = lerp(a?.gdp, b?.gdp, u);
    const happiness = lerp(a?.happiness, b?.happiness, u);
    const population = lerp(a?.population, b?.population, u);
    if (!(gdp > 0) || happiness == null || !(population > 0)) return;
    items.push({
      ...src,
      gdp,
      happiness,
      population,
      year: t,
    });
  });
  return items;
}

function gdpLayout() {
  const { width } = chartSize("#gdp-chart", 460);
  const height = 460;
  const margin = { top: 28, right: 22, bottom: 58, left: 66 };
  const withGdp = state.rows.filter((row) => row.gdp > 0 && row.population > 0);
  const gdpExtent = d3.extent(withGdp, (d) => d.gdp);
  const x = d3.scaleLog()
    .domain([Math.max(400, gdpExtent[0] * 0.9), gdpExtent[1] * 1.15])
    .range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([1.5, 8.2]).range([height - margin.bottom, margin.top]);
  const radius = d3.scaleSqrt()
    .domain(d3.extent(withGdp, (d) => d.population))
    .range([3.5, 28]);
  const allMean = d3.mean(state.rows, (d) => d.happiness);
  const happinessExtent = d3.extent(state.rows, (d) => d.happiness);
  const color = d3.scaleLinear()
    .domain([happinessExtent[0], allMean, happinessExtent[1]])
    .range(["#2c7bb6", "#f4f1e9", "#d7191c"])
    .clamp(true);
  return { width, height, margin, x, y, radius, color };
}

function drawGdpAxes(root, layout) {
  const { width, height, margin, x, y } = layout;
  const gdpTicks = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000]
    .filter((value) => value >= x.domain()[0] && value <= x.domain()[1]);
  root.append("g").attr("class", "gdp-axis gdp-axis-x")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues(gdpTicks).tickFormat(formatGdpTick).tickSizeOuter(0))
    .call((g) => g.select(".domain").attr("stroke", "#c8c1b4"))
    .call((g) => g.selectAll("text").attr("fill", "#33413b").attr("font-size", 12).attr("font-weight", 500));
  root.append("g").attr("class", "gdp-axis gdp-axis-y")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0))
    .call((g) => g.select(".domain").attr("stroke", "#c8c1b4"))
    .call((g) => g.selectAll("text").attr("fill", "#33413b").attr("font-size", 12).attr("font-weight", 500));
  root.append("text").attr("class", "gdp-axis-label")
    .attr("text-anchor", "middle")
    .attr("x", (width + margin.left - margin.right) / 2)
    .attr("y", height - 10)
    .attr("fill", "#17211d")
    .attr("font-size", 17)
    .attr("font-weight", 700)
    .text("GDP per capita (income)");
  root.append("text").attr("class", "gdp-axis-label")
    .attr("text-anchor", "middle")
    .attr("transform", `translate(22, ${(height + margin.top - margin.bottom) / 2}) rotate(-90)`)
    .attr("fill", "#17211d")
    .attr("font-size", 17)
    .attr("font-weight", 700)
    .text("Life satisfaction");
  root.append("line").attr("class", "gdp-mean")
    .attr("x1", margin.left).attr("x2", width - margin.right)
    .attr("stroke", "#65706b").attr("stroke-dasharray", "3 3");
  root.append("g").attr("class", "gdp-dots");
}

function updateGdpScatter() {
  const chart = document.getElementById("gdp-chart");
  if (!chart) return;
  const layout = gdpLayout();
  const svg = d3.select("#gdp-chart").selectAll("svg").data([null]);
  const root = svg.enter().append("svg").merge(svg);
  const sizeKey = `${Math.round(layout.width)}x${layout.height}`;
  if (root.attr("data-size") !== sizeKey) {
    root.attr("viewBox", `0 0 ${layout.width} ${layout.height}`).attr("data-size", sizeKey);
    root.selectAll("*").remove();
    drawGdpAxes(root, layout);
  }
  const items = gdpItemsAt(gdpState.t ?? gdpState.year);
  const mean = d3.mean(items, (d) => d.happiness);
  root.select("line.gdp-mean")
    .attr("y1", mean == null ? layout.y(5.5) : layout.y(mean))
    .attr("y2", mean == null ? layout.y(5.5) : layout.y(mean))
    .attr("opacity", mean == null ? 0 : 1);
  root.select("g.gdp-dots").selectAll("circle").data(items, (d) => d.iso)
    .join(
      (enter) => enter.append("circle")
        .attr("cx", (d) => layout.x(d.gdp))
        .attr("cy", (d) => layout.y(d.happiness))
        .attr("r", 0)
        .attr("fill", (d) => layout.color(d.happiness))
        .attr("fill-opacity", 0.82)
        .attr("stroke", (d) => (state.selected.has(d.iso) || state.hover === d.iso ? "#17211d" : "rgba(23,33,29,.28)"))
        .attr("stroke-width", (d) => (state.selected.has(d.iso) || state.hover === d.iso ? 2.6 : 0.7))
        .style("cursor", "pointer")
        .call((sel) => sel.transition().duration(280).attr("r", (d) => layout.radius(d.population))),
      (update) => update,
      (exit) => exit.transition().duration(220).attr("r", 0).remove()
    )
    .attr("cx", (d) => layout.x(d.gdp))
    .attr("cy", (d) => layout.y(d.happiness))
    .attr("r", (d) => layout.radius(d.population))
    .attr("fill", (d) => layout.color(d.happiness))
    .attr("stroke", (d) => (state.selected.has(d.iso) || state.hover === d.iso ? "#17211d" : "rgba(23,33,29,.28)"))
    .attr("stroke-width", (d) => (state.selected.has(d.iso) || state.hover === d.iso ? 2.6 : 0.7))
    .style("cursor", "pointer")
    .on("mousemove", (event, d) => {
      state.hover = d.iso;
      showTooltip(event, d, mean);
      highlight(d.iso);
    })
    .on("mouseleave", () => {
      state.hover = null;
      hideTooltip();
      highlight(null);
    })
    .on("click", (_, d) => toggleSelect(d.iso));
}

function drawGdpScatter() {
  updateGdpScatter();
}

function syncGdpYearReadout(year) {
  d3.select("#gdp-year-slider").property("value", year);
  d3.select("#gdp-year-readout").text(year);
}

function stopGdpTween() {
  if (gdpState.tween) gdpState.tween.stop();
  gdpState.tween = null;
}

function setGdpYear(year, options) {
  year = +year;
  if (YEARS_WITH_GAP.includes(year)) year = 2014;
  const animate = !options || options.animate !== false;
  const from = gdpState.t == null ? gdpState.year : gdpState.t;
  gdpState.year = year;
  syncGdpYearReadout(year);
  stopGdpTween();
  if (!animate || Math.abs(from - year) < 0.02) {
    gdpState.t = year;
    updateGdpScatter();
    return;
  }
  const duration = Math.min(900, 260 + Math.abs(year - from) * 160);
  const started = performance.now();
  gdpState.tween = d3.timer(() => {
    const u = Math.min(1, (performance.now() - started) / duration);
    gdpState.t = from + (year - from) * d3.easeCubicInOut(u);
    updateGdpScatter();
    if (u >= 1) {
      stopGdpTween();
      gdpState.t = year;
      updateGdpScatter();
    }
  });
}

function startGdpTimer() {
  if (gdpState.timer) return;
  stopGdpTween();
  gdpState.t = gdpState.t == null ? gdpState.year : gdpState.t;
  let last = performance.now();
  const first = state.years[0];
  const finalYear = state.years[state.years.length - 1];
  gdpState.timer = d3.timer(() => {
    const now = performance.now();
    const step = (now - last) / GDP_YEAR_MS;
    last = now;
    gdpState.t += step;
    if (gdpState.t > finalYear) gdpState.t = first;
    gdpState.year = displayGdpYear(gdpState.t);
    syncGdpYearReadout(gdpState.year);
    updateGdpScatter();
  });
}

function stopGdpTimer() {
  if (gdpState.timer) gdpState.timer.stop();
  gdpState.timer = null;
  stopGdpTween();
}

function resetGdpView() {
  stopGdpTimer();
  const year = state.years.includes(DEFAULT_YEAR) ? DEFAULT_YEAR : state.years[state.years.length - 1];
  setGdpYear(year, { animate: true });
}

function highlight(iso) {
  d3.selectAll("#dorling-map circle, #change-chart circle, #rank-chart rect")
    .attr("stroke-width", function width(d) {
      if (!d) return null;
      return d.iso === iso || state.selected.has(d.iso) || state.selectedContinents.has(d.continent) ? 2 : 0.7;
    });
  d3.selectAll("#gdp-chart circle")
    .attr("stroke", (d) => (d && (d.iso === iso || state.selected.has(d.iso)) ? "#17211d" : "rgba(23,33,29,.28)"))
    .attr("stroke-width", (d) => (d && (d.iso === iso || state.selected.has(d.iso)) ? 2.6 : 0.7));
  d3.selectAll("#entity-list .entity-row").classed("is-hover", (d) => d && d.iso === iso);
}

function renderMap() {
  const allYear = enrich(visibleRows());
  const rows = activeRows();
  const mean = d3.mean(allYear, (d) => d.happiness);
  const color = colorScale(allYear);
  const radius = radiusScale(allYear);
  updateSummary(rows, mean);
  drawIncomePills(allYear);
  drawColorLegend(color, allYear);
  drawSizeLegend(radius);
  drawDorling(rows, color, radius, mean);
  drawEntityList(allYear, color, mean);
  setStatus(`${state.year} · ${rows.length} countries`);
}

function renderNotes() {
  const live = liveRows();
  const liveActive = live.filter((row) => isIncomeOn(row.income_group));
  const liveMean = d3.mean(live, (d) => d.happiness);
  const liveColor = colorScale(live);
  const liveRadius = radiusScale(live);
  drawRank(live, liveColor, liveMean);
  drawChange(liveActive, liveColor, liveRadius, liveMean);
  drawTrajectories(liveMean);
}

function renderAll(options) {
  const notesOnly = options && options.notesOnly;
  const mapOnly = options && options.mapOnly;
  const skipGdp = options && options.skipGdp;
  if (!notesOnly) renderMap();
  if (!mapOnly) renderNotes();
  if (!notesOnly && !mapOnly && !skipGdp) updateGdpScatter();
}

function bindControls() {
  d3.selectAll("#year-slider, .note-year-slider").on("input", function onYear() {
    stopTimer();
    setYear(this.value);
  });
  d3.select("#entity-search").on("input", function onSearch() {
    state.search = this.value;
    renderAll();
  });
  d3.select("#entity-sort").on("change", function onSort() {
    state.sort = this.value;
    renderAll();
  });
  d3.select("#entity-type").on("change", function onType() {
    state.type = this.value;
    renderAll();
  });
  d3.select("#reset-view").on("click", resetView);
  const toggleList = () => {
    const panel = document.getElementById("entity-panel");
    setListOpen(panel.hidden);
  };
  d3.select("#toggle-list").on("click", toggleList);
  d3.select("#hide-list").on("click", () => setListOpen(false));
  d3.select("#rank-buoy").on("click", () => setFloatOpen("rank-panel", true));
  d3.select("#change-buoy").on("click", () => setFloatOpen("change-panel", true));
  d3.select("#traj-buoy").on("click", () => setFloatOpen("traj-panel", true));
  d3.select("#close-rank").on("click", () => setFloatOpen("rank-panel", false));
  d3.select("#close-change").on("click", () => setFloatOpen("change-panel", false));
  d3.select("#close-traj").on("click", () => setFloatOpen("traj-panel", false));
  FLOAT_PANELS.forEach(bindFloatDrag);
  d3.select("#clear-selection").on("click", clearSelection);
  d3.select("#year-play").on("click", startTimer);
  d3.select("#year-pause").on("click", stopTimer);
  d3.selectAll(".change-year-toggle").on("click", (event) => {
    event.stopPropagation();
    toggleTimer();
  });
  d3.select("#gdp-year-slider").on("input", function onGdpYear() {
    stopGdpTimer();
    setGdpYear(this.value);
  });
  d3.select("#gdp-play").on("click", startGdpTimer);
  d3.select("#gdp-pause").on("click", stopGdpTimer);
  d3.select("#gdp-reset").on("click", resetGdpView);
  syncPlayUi();
}

function parseRows(raw) {
  return raw.map((row) => ({
    country: row.country,
    iso: row.iso,
    year: +row.year,
    happiness: +row.happiness,
    population: +row.population,
    gdp: row.gdp === "" || row.gdp == null ? null : +row.gdp,
    income_group: row.income_group,
    continent: row.continent,
    lon: +row.lon,
    lat: +row.lat,
  }));
}

Promise.all([
  d3.csv(DATA_URL),
  d3.json(WORLD_URL),
]).then(([raw, world]) => {
  state.rows = parseRows(raw);
  state.years = Array.from(new Set(state.rows.map((d) => d.year))).sort((a, b) => a - b);
  state.byIso = d3.group(state.rows, (d) => d.iso);
  state.byIso.forEach((series) => series.sort((a, b) => a.year - b.year));
  state.land = topojson.feature(world, world.objects.land);
  state.year = state.years.includes(DEFAULT_YEAR) ? DEFAULT_YEAR : state.years[state.years.length - 1];
  state.t = state.year;
  bindControls();
  d3.selectAll("#year-slider, .note-year-slider, #gdp-year-slider")
    .attr("min", state.years[0])
    .attr("max", state.years[state.years.length - 1]);
  d3.selectAll("#year-slider, .note-year-slider").property("value", state.year);
  d3.selectAll(".note-year-readout").text(state.year);
  gdpState.year = state.years.includes(DEFAULT_YEAR) ? DEFAULT_YEAR : state.years[state.years.length - 1];
  gdpState.t = gdpState.year;
  d3.select("#gdp-year-slider").property("value", gdpState.year);
  d3.select("#gdp-year-readout").text(gdpState.year);
  renderAll();
  drawGdpScatter();
  window.addEventListener("resize", () => {
    renderAll();
    drawGdpScatter();
  });
}).catch((error) => {
  setStatus("Could not load data");
  d3.select("#dorling-map").html(`<p class="chart-error">${error.message}</p>`);
});
