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
  scrollTo: null,
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

function stopTimer() {
  if (state.timer) state.timer.stop();
  state.timer = null;
}

function visibleRows() {
  return state.rows.filter((row) => row.year === state.year);
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
  state.incomes = new Set(INCOME_GROUPS.map((item) => item.id));
  state.selected.clear();
  state.selectedContinents.clear();
  state.hover = null;
  state.search = "";
  state.sort = "score-desc";
  state.type = "countries";
  state.scrollTo = null;
  d3.select("#year-slider").property("value", state.year);
  d3.select("#entity-search").property("value", "");
  d3.select("#entity-sort").property("value", "score-desc");
  d3.select("#entity-type").property("value", "countries");
  setListOpen(false);
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
  const maxR = radius(5e8);
  const gap = 8;
  const pad = 8;
  const items = [];
  let cx = pad;
  pops.forEach((pop) => {
    const r = radius(pop);
    cx += r;
    items.push({ pop, r, cx, label: labeled.get(pop) || null });
    cx += r + gap;
  });
  const width = Math.max(cx, 280);
  const height = maxR * 2 + 26;
  const baseline = maxR + 6;
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
        .attr("y", baseline + maxR + 14)
        .attr("text-anchor", "middle")
        .attr("fill", "#65706b")
        .attr("font-size", 11)
        .text(item.label);
    }
  });
}

function drawDorling(rows, color, radius, mean) {
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
  for (let i = 0; i < 140; i += 1) simulation.tick();
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
    const node = row.filter((d) => d.iso === state.scrollTo).node();
    if (node) node.scrollIntoView({ block: "nearest" });
    state.scrollTo = null;
  }
}

function drawChange(rows, color, radius, mean) {
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
  root.append("text").attr("x", margin.left).attr("y", 12)
    .attr("fill", "#65706b").attr("font-size", 10)
    .text("Change since first year");
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

function drawTrajectories(mean) {
  const { width } = chartSize("#trajectory-chart", 220);
  const height = 220;
  const margin = { top: 16, right: 88, bottom: 28, left: 30 };
  const svg = d3.select("#trajectory-chart").selectAll("svg").data([null]);
  const root = svg.enter().append("svg").merge(svg).attr("viewBox", `0 0 ${width} ${height}`);
  root.selectAll("*").remove();

  const x = d3.scaleLinear().domain([2011, 2025]).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([1, 8.2]).range([height - margin.bottom, margin.top]);
  root.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues([2011, 2015, 2020, 2025]).tickFormat(d3.format("d")).tickSizeOuter(0))
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
      series: (state.byIso.get(iso) || []).filter((d) => d.happiness != null),
    })),
    ...Array.from(state.selectedContinents).map((name) => ({
      iso: name,
      name,
      series: continentSeries(name),
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
    const last = item.series.find((d) => d.year === state.year) || item.series[item.series.length - 1];
    root.append("circle")
      .attr("cx", x(last.year)).attr("cy", y(last.happiness)).attr("r", 3.5)
      .attr("fill", color).attr("stroke", "#17211d");
    root.append("text")
      .attr("x", x(last.year) + 6).attr("y", y(last.happiness) + 3)
      .attr("fill", "#17211d").attr("font-size", 10)
      .text(item.name);
  });
}

function highlight(iso) {
  d3.selectAll("#dorling-map circle, #change-chart circle")
    .attr("stroke-width", function width(d) {
      if (!d) return null;
      return d.iso === iso || state.selected.has(d.iso) || state.selectedContinents.has(d.continent) ? 2 : 0.7;
    });
  d3.selectAll("#entity-list .entity-row").classed("is-hover", (d) => d && d.iso === iso);
}

function renderAll() {
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
  d3.select("#toggle-list").on("click", () => {
    const panel = document.getElementById("entity-panel");
    setListOpen(panel.hidden);
  });
  d3.select("#hide-list").on("click", () => setListOpen(false));
  d3.select("#clear-selection").on("click", clearSelection);
  d3.select("#year-play").on("click", () => {
    if (state.timer) return;
    state.timer = d3.interval(nextYear, 900);
  });
  d3.select("#year-pause").on("click", stopTimer);
}

function parseRows(raw) {
  return raw.map((row) => ({
    country: row.country,
    iso: row.iso,
    year: +row.year,
    happiness: +row.happiness,
    population: +row.population,
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
