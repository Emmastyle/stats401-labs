const DATA_URL = "../data/project_life_satisfaction.csv";
const WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const MAX_SELECTED = 8;
const YEARS_WITH_GAP = [2013];

const state = {
  year: 2025,
  income: "All",
  selected: new Set(),
  hover: null,
  rows: [],
  byIso: new Map(),
  years: [],
  land: null,
  positions: new Map(),
  timer: null,
};

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

function visibleRows() {
  return state.rows.filter((row) => row.year === state.year);
}

function activeRows() {
  const rows = visibleRows();
  if (state.income === "All") return rows;
  return rows.filter((row) => row.income_group === state.income);
}

function firstRecord(iso) {
  const series = state.byIso.get(iso) || [];
  return series[0] || null;
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
      `Score ${formatScore(row.happiness)} · rank ${row.rank} of ${visibleRows().length}<br>` +
      `Population ${formatPop(row.population)}<br>` +
      `Income ${row.income_group}<br>` +
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
  if (state.selected.has(iso)) {
    state.selected.delete(iso);
  } else if (state.selected.size < MAX_SELECTED) {
    state.selected.add(iso);
  }
  renderAll();
}

function chartSize(selector, fallbackHeight) {
  const node = document.querySelector(selector);
  const width = Math.max(node.getBoundingClientRect().width, 280);
  return { width, height: fallbackHeight };
}

function updateSummary(rows, mean) {
  d3.select("#summary-year").text(state.year);
  d3.select("#summary-count").text(rows.length);
  d3.select("#summary-mean").text(formatScore(mean));
  d3.select("#summary-income").text(state.income);
  if (!state.selected.size) {
    d3.select("#summary-selected").text("None");
    return;
  }
  const names = visibleRows()
    .filter((row) => state.selected.has(row.iso))
    .map((row) => row.country);
  d3.select("#summary-selected").text(names.join(", "));
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
  const defs = root.append("defs");
  const grad = defs.append("linearGradient").attr("id", "happiness-gradient");
  d3.range(0, 1.01, 0.08).forEach((t) => {
    grad.append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", scale(x.invert(t * width)));
  });
  root.append("rect").attr("width", width).attr("height", height).attr("fill", "url(#happiness-gradient)");
  root.append("line")
    .attr("x1", x(mean)).attr("x2", x(mean))
    .attr("y1", 0).attr("y2", height)
    .attr("stroke", "#17211d").attr("stroke-width", 1);
}

function drawSizeLegend(radius) {
  const samples = [5e6, 5e7, 5e8];
  const maxR = radius(samples[samples.length - 1]);
  const width = 220;
  const height = maxR * 2 + 8;
  const svg = d3.select("#size-legend").selectAll("svg").data([null]);
  const root = svg.enter().append("svg").merge(svg).attr("viewBox", `0 0 ${width} ${height}`);
  root.selectAll("*").remove();
  let x = 16;
  samples.forEach((pop) => {
    const r = radius(pop);
    root.append("circle").attr("cx", x).attr("cy", height / 2).attr("r", r)
      .attr("fill", "none").attr("stroke", "#17211d");
    root.append("text").attr("x", x).attr("y", height - 2).attr("text-anchor", "middle")
      .attr("fill", "#65706b").attr("font-size", 10)
      .text(pop >= 1e8 ? `${pop / 1e6}M` : `${pop / 1e6}M`);
    x += r * 2 + 28;
  });
}

function drawDorling(rows, color, radius, mean) {
  const { width, height } = chartSize("#dorling-map", 520);
  const svg = d3.select("#dorling-map").selectAll("svg").data([null]);
  const root = svg.enter().append("svg").merge(svg)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img");
  if (root.select("g.land").empty()) {
    root.append("g").attr("class", "land");
    root.append("g").attr("class", "countries");
  }

  const projection = d3.geoNaturalEarth1().fitExtent([[16, 12], [width - 16, height - 12]], { type: "Sphere" });
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
  for (let i = 0; i < 140; i += 1) simulation.tick();
  nodes.forEach((node) => state.positions.set(node.iso, { x: node.x, y: node.y }));

  const drawRows = state.income === "All" ? nodes : nodes.concat(
    visibleRows()
      .filter((row) => row.income_group !== state.income)
      .map((row) => {
        const point = projection([row.lon, row.lat]) || [width / 2, height / 2];
        const prev = state.positions.get(row.iso) || { x: point[0], y: point[1] };
        return { ...row, x: prev.x, y: prev.y, r: radius(row.population), faded: true };
      })
  );

  const circles = root.select("g.countries").selectAll("circle").data(drawRows, (d) => d.iso);
  circles.join(
    (enter) => enter.append("circle")
      .attr("class", "country-dot")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => d.r),
    (update) => update,
    (exit) => exit.remove()
  )
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("r", (d) => d.r)
    .attr("fill", (d) => color(d.happiness))
    .attr("fill-opacity", (d) => (d.faded ? 0.12 : 0.92))
    .attr("stroke", (d) => {
      if (state.selected.has(d.iso)) return "#17211d";
      if (state.hover === d.iso) return "#e8582a";
      return "rgba(23,33,29,.28)";
    })
    .attr("stroke-width", (d) => (state.selected.has(d.iso) || state.hover === d.iso ? 2 : 0.7))
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

function rankRows(rows) {
  if (state.selected.size) {
    return rows.filter((row) => state.selected.has(row.iso))
      .sort((a, b) => d3.descending(a.happiness, b.happiness));
  }
  const sorted = rows.slice().sort((a, b) => d3.descending(a.happiness, b.happiness));
  const picked = [];
  const seen = new Set();
  sorted.slice(0, 5).concat(sorted.slice(-5)).forEach((row) => {
    if (seen.has(row.iso)) return;
    seen.add(row.iso);
    picked.push(row);
  });
  return picked;
}

function drawRank(rows, color, mean) {
  const items = rankRows(rows);
  const { width } = chartSize("#rank-chart", 320);
  const rowH = 28;
  const margin = { top: 8, right: 16, bottom: 28, left: 108 };
  const height = margin.top + margin.bottom + Math.max(items.length, 1) * rowH;
  const svg = d3.select("#rank-chart").selectAll("svg").data([null]);
  const root = svg.enter().append("svg").merge(svg).attr("viewBox", `0 0 ${width} ${height}`);
  root.selectAll("*").remove();
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
    .attr("stroke", (d) => (state.selected.has(d.iso) || state.hover === d.iso ? "#17211d" : "none"))
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

  groups.append("text")
    .attr("x", (d) => x(d.happiness) + 6).attr("y", 16)
    .attr("fill", "#65706b").attr("font-size", 11)
    .text((d) => formatScore(d.happiness));
}

function drawChange(rows, color, radius, mean) {
  const items = rows.filter((row) => row.change != null);
  const { width } = chartSize("#change-chart", 320);
  const height = 320;
  const margin = { top: 16, right: 16, bottom: 36, left: 44 };
  const svg = d3.select("#change-chart").selectAll("svg").data([null]);
  const root = svg.enter().append("svg").merge(svg).attr("viewBox", `0 0 ${width} ${height}`);
  root.selectAll("*").remove();

  const x = d3.scaleLinear().domain([1, 8.2]).range([margin.left, width - margin.right]);
  const yExtent = d3.extent(items, (d) => d.change);
  const yPad = 0.25;
  const y = d3.scaleLinear()
    .domain([(yExtent[0] ?? -1) - yPad, (yExtent[1] ?? 1) + yPad])
    .range([height - margin.bottom, margin.top]);

  root.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6).tickSizeOuter(0))
    .call((g) => g.select(".domain").attr("stroke", "#c8c1b4"))
    .call((g) => g.selectAll("text").attr("fill", "#65706b"));
  root.append("g").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0))
    .call((g) => g.select(".domain").attr("stroke", "#c8c1b4"))
    .call((g) => g.selectAll("text").attr("fill", "#65706b"));
  root.append("text").attr("x", width - margin.right).attr("y", height - 8)
    .attr("text-anchor", "end").attr("fill", "#65706b").attr("font-size", 11)
    .text("Current score");
  root.append("text").attr("x", margin.left).attr("y", 12)
    .attr("fill", "#65706b").attr("font-size", 11)
    .text("Change since first year");
  root.append("line")
    .attr("x1", margin.left).attr("x2", width - margin.right)
    .attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", "#65706b").attr("stroke-dasharray", "3 3");
  root.append("line")
    .attr("x1", x(mean)).attr("x2", x(mean))
    .attr("y1", margin.top).attr("y2", height - margin.bottom)
    .attr("stroke", "#65706b").attr("stroke-dasharray", "3 3");

  root.selectAll("circle").data(items, (d) => d.iso).join("circle")
    .attr("cx", (d) => x(d.happiness))
    .attr("cy", (d) => y(d.change))
    .attr("r", (d) => Math.max(3, radius(d.population) * 0.45))
    .attr("fill", (d) => color(d.happiness))
    .attr("fill-opacity", (d) => (state.selected.size && !state.selected.has(d.iso) ? 0.16 : 0.88))
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

function drawTrajectories(mean) {
  const { width } = chartSize("#trajectory-chart", 280);
  const height = 280;
  const margin = { top: 16, right: 110, bottom: 32, left: 36 };
  const svg = d3.select("#trajectory-chart").selectAll("svg").data([null]);
  const root = svg.enter().append("svg").merge(svg).attr("viewBox", `0 0 ${width} ${height}`);
  root.selectAll("*").remove();

  const x = d3.scaleLinear().domain([2011, 2025]).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([1, 8.2]).range([height - margin.bottom, margin.top]);
  root.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues(state.years).tickFormat(d3.format("d")).tickSizeOuter(0))
    .call((g) => g.select(".domain").attr("stroke", "#c8c1b4"))
    .call((g) => g.selectAll("text").attr("fill", "#65706b").attr("transform", "rotate(-40)").attr("text-anchor", "end"));
  root.append("g").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0))
    .call((g) => g.select(".domain").attr("stroke", "#c8c1b4"))
    .call((g) => g.selectAll("text").attr("fill", "#65706b"));
  root.append("line")
    .attr("x1", margin.left).attr("x2", width - margin.right)
    .attr("y1", y(mean)).attr("y2", y(mean))
    .attr("stroke", "#65706b").attr("stroke-dasharray", "3 3");

  if (!state.selected.size) {
    root.append("text")
      .attr("x", (width + margin.left - margin.right) / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#65706b")
      .attr("font-size", 13)
      .text("Click countries on the map to see their paths.");
    return;
  }

  const line = d3.line()
    .x((d) => x(d.year))
    .y((d) => y(d.happiness))
    .defined((d) => d.happiness != null);

  const palette = d3.schemeTableau10;
  const selected = Array.from(state.selected);
  selected.forEach((iso, index) => {
    const series = (state.byIso.get(iso) || []).filter((d) => d.happiness != null);
    const color = palette[index % palette.length];
    root.append("path")
      .datum(series)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", iso === state.hover ? 3 : 2)
      .attr("d", line);
    const last = series.find((d) => d.year === state.year) || series[series.length - 1];
    if (!last) return;
    root.append("circle")
      .attr("cx", x(last.year)).attr("cy", y(last.happiness)).attr("r", 4)
      .attr("fill", color).attr("stroke", "#17211d");
    root.append("text")
      .attr("x", x(last.year) + 8).attr("y", y(last.happiness) + 4)
      .attr("fill", "#17211d").attr("font-size", 11)
      .text(last.country);
  });
}

function highlight(iso) {
  d3.selectAll("#dorling-map circle, #change-chart circle, #rank-chart rect")
    .attr("stroke-width", function strokeWidth(d) {
      if (!d) return null;
      return d.iso === iso || state.selected.has(d.iso) ? 2 : 0.7;
    });
}

function renderAll() {
  const allYear = enrich(visibleRows());
  const rows = state.income === "All" ? allYear : allYear.filter((row) => row.income_group === state.income);
  const mean = d3.mean(allYear, (d) => d.happiness);
  const color = colorScale(allYear);
  const radius = radiusScale(allYear);
  updateSummary(rows, mean);
  drawColorLegend(color, allYear);
  drawSizeLegend(radius);
  drawDorling(rows, color, radius, mean);
  drawRank(rows, color, mean);
  drawChange(rows, color, radius, mean);
  drawTrajectories(mean);
  setStatus(`${state.year} · ${rows.length} countries`);
}

function nextYear() {
  const index = state.years.indexOf(state.year);
  state.year = state.years[(index + 1) % state.years.length];
  d3.select("#year-slider").property("value", state.year);
  renderAll();
}

function bindControls() {
  d3.select("#year-slider").on("input", function onYear() {
    state.year = +this.value;
    if (YEARS_WITH_GAP.includes(state.year)) {
      state.year = 2014;
      this.value = 2014;
    }
    renderAll();
  });
  d3.select("#income-filter").on("change", function onIncome() {
    state.income = this.value;
    renderAll();
  });
  d3.select("#clear-selection").on("click", () => {
    state.selected.clear();
    renderAll();
  });
  d3.select("#year-play").on("click", () => {
    if (state.timer) return;
    state.timer = d3.interval(nextYear, 900);
  });
  d3.select("#year-pause").on("click", () => {
    if (state.timer) state.timer.stop();
    state.timer = null;
  });
}

function parseRows(raw) {
  return raw.map((row) => ({
    country: row.country,
    iso: row.iso,
    year: +row.year,
    happiness: +row.happiness,
    population: +row.population,
    income_group: row.income_group,
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
  state.year = 2025;
  bindControls();
  d3.select("#year-slider")
    .attr("min", state.years[0])
    .attr("max", state.years[state.years.length - 1])
    .property("value", state.year);
  renderAll();
  window.addEventListener("resize", () => renderAll());
}).catch((error) => {
  setStatus("Could not load data");
  d3.select("#dorling-map").html(`<p class="chart-error">${error.message}</p>`);
});
