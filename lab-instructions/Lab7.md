# Lab 7 — Temporal Data Visualization with D3

**STATS 401: Data Acquisition and Visualization**

## Learning Objectives

By the end of this lab, you should be able to:

1. Parse and visualize temporal data with D3.
2. Create line charts for one or multiple time series.
3. switch among temporal metrics.
4. Add hover details and time-range filtering.
5. Create controllable temporal animation with play, pause, reset, and a time slider.
6. Apply temporal visualization techniques to a network whose connectivity changes over time.

---

# 0. Temporal Data

Temporal data contains observations associated with time:

```text
Daily temperature
Hourly traffic
Monthly sales
Annual GDP
Stock prices
Network connections over time
```

A common structure is:

```text
time → entity → measurement(s)
```

Temporal visualization can use two broad strategies:

```text
Time mapped to space
→ line chart, timeline, small multiples

Time mapped to time
→ animation
```

This lab introduces both.

---

# Task 1 — Weather Dataset

Use:

```text
data/lab7_historical_weather.csv
```

It contains **180 daily observations** for eight cities:

```text
New York, London, Tokyo, Singapore,
Sydney, Cairo, São Paulo, Toronto
```

Variables:

| Variable | Meaning |
|---|---|
| `date` | Observation date |
| `city` | City |
| `country` | Country |
| `temperature_c` | Temperature (°C) |
| `humidity_pct` | Relative humidity (%) |
| `wind_speed_mps` | Wind speed (m/s) |
| `pressure_hpa` | Atmospheric pressure (hPa) |
| `precipitation_mm` | Daily precipitation (mm) |

> This is a **synthetic historical-style dataset** created for visualization practice. It contains plausible temporal patterns but should not be used for meteorological analysis.

---

# Task 2 — Load and Parse Dates

```javascript
d3.csv(
    "../data/lab7_historical_weather.csv",
    d => ({
        date: d3.timeParse("%Y-%m-%d")(d.date),
        city: d.city,
        country: d.country,
        temperature_c: +d.temperature_c,
        humidity_pct: +d.humidity_pct,
        wind_speed_mps: +d.wind_speed_mps,
        pressure_hpa: +d.pressure_hpa,
        precipitation_mm: +d.precipitation_mm
    })
)
.then(data => {
    console.log(data);
});
```

`d3.timeParse()` converts a string such as:

```text
2025-01-01
```

into a JavaScript `Date`.

---

# Task 3 — Create a Line Chart

Start with Tokyo:

```javascript
const cityData = data
    .filter(d => d.city === "Tokyo")
    .sort(
        (a, b) =>
            d3.ascending(a.date, b.date)
    );
```

Create SVG:

```javascript
const width = 900;
const height = 500;

const margin = {
    top: 40,
    right: 40,
    bottom: 70,
    left: 70
};

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);
```

Create scales:

```javascript
const xScale = d3.scaleTime()
    .domain(
        d3.extent(cityData, d => d.date)
    )
    .range([
        margin.left,
        width - margin.right
    ]);

const yScale = d3.scaleLinear()
    .domain(
        d3.extent(
            cityData,
            d => d.temperature_c
        )
    )
    .nice()
    .range([
        height - margin.bottom,
        margin.top
    ]);
```

Axes:

```javascript
svg.append("g")
    .attr(
        "transform",
        `translate(0,${height-margin.bottom})`
    )
    .call(d3.axisBottom(xScale));

svg.append("g")
    .attr(
        "transform",
        `translate(${margin.left},0)`
    )
    .call(d3.axisLeft(yScale));
```

Line generator:

```javascript
const line = d3.line()
    .x(d => xScale(d.date))
    .y(d => yScale(d.temperature_c));
```

Draw:

```javascript
svg.append("path")
    .datum(cityData)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2)
    .attr("d", line);
```

Conceptually:

```text
Temperature
    │       /\
    │  /\__/  \___/\
    │_/            \__
    └────────────────── Time
```

---

# Task 4 — Compare Multiple Cities

```javascript
const selectedCities = [
    "Tokyo",
    "London",
    "New York"
];

const filteredData = data.filter(
    d => selectedCities.includes(d.city)
);

const grouped = d3.group(
    filteredData,
    d => d.city
);

const colorScale = d3.scaleOrdinal()
    .domain(selectedCities)
    .range(d3.schemeTableau10);
```

Draw one line per city:

```javascript
svg.selectAll(".city-line")
    .data(grouped)
    .join("path")
    .attr("class", "city-line")
    .attr("fill", "none")
    .attr(
        "stroke",
        d => colorScale(d[0])
    )
    .attr("stroke-width", 2)
    .attr(
        "d",
        d => line(d[1])
    );
```

Here:

```text
d[0] → city
d[1] → observations for that city
```

---

# Task 5 — Switch Weather Metrics

Add:

```html
<select id="metric">
    <option value="temperature_c">Temperature</option>
    <option value="humidity_pct">Humidity</option>
    <option value="wind_speed_mps">Wind Speed</option>
    <option value="pressure_hpa">Pressure</option>
    <option value="precipitation_mm">Precipitation</option>
</select>
```

Listen:

```javascript
d3.select("#metric")
    .on("change", function() {
        updateChart(this.value);
    });
```

Update:

```javascript
function updateChart(metric) {

    yScale
        .domain(
            d3.extent(
                filteredData,
                d => d[metric]
            )
        )
        .nice();

    line.y(
        d => yScale(d[metric])
    );

    svg.selectAll(".city-line")
        .transition()
        .duration(600)
        .attr(
            "d",
            d => line(d[1])
        );
}
```

---

# Task 6 — Hover Details

Use a tooltip:

```html
<div id="tooltip" class="tooltip"></div>
```

Find the closest observation to the mouse:

```javascript
const bisectDate =
    d3.bisector(d => d.date).center;

function moved(event) {

    const [mouseX] = d3.pointer(event);

    const date =
        xScale.invert(mouseX);

    const index =
        bisectDate(cityData, date);

    const d = cityData[index];

    tooltip
        .style("opacity", 1)
        .html(`
            <strong>${d.city}</strong><br>
            ${d3.timeFormat("%Y-%m-%d")(d.date)}<br>
            Temperature: ${d.temperature_c} °C<br>
            Humidity: ${d.humidity_pct}%<br>
            Wind: ${d.wind_speed_mps} m/s<br>
            Pressure: ${d.pressure_hpa} hPa
        `);
}
```

Important:

```javascript
xScale.invert(mouseX)
```

converts a screen position back into a date.

---

# Task 7 — Time-Range Filtering

A simple interface:

```html
<input type="date" id="start-date">
<input type="date" id="end-date">

<button id="apply-range">
    Apply Range
</button>
```

Filter:

```javascript
const rangeData =
    cityData.filter(
        d =>
            d.date >= startDate &&
            d.date <= endDate
    );
```

Then update:

```javascript
xScale.domain(
    d3.extent(rangeData, d => d.date)
);

yScale
    .domain(
        d3.extent(
            rangeData,
            d => d.temperature_c
        )
    )
    .nice();
```

You can also use:

```javascript
d3.brushX()
```

to let users select a time interval directly on the visualization.

Example:

```javascript
const brush = d3.brushX()
    .extent([
        [margin.left, margin.top],
        [
            width - margin.right,
            height - margin.bottom
        ]
    ])
    .on("end", brushed);

svg.append("g")
    .call(brush);

function brushed(event) {

    if (!event.selection) {
        return;
    }

    const [x0, x1] =
        event.selection;

    const startDate =
        xScale.invert(x0);

    const endDate =
        xScale.invert(x1);

    console.log(
        startDate,
        endDate
    );
}
```

---

# Task 8 — Animated Temporal Visualization

A line chart maps:

```text
time → x-position
```

so many time points are visible simultaneously.

Animation instead maps:

```text
data time → animation time
```

For example:

```text
Jan 1 → Jan 2 → Jan 3 → Jan 4
```

Animation is useful when the question focuses on:

```text
change
appearance/disappearance
movement
evolution
```

A temporal animation should normally provide:

```text
Play
Pause
Reset
Time slider
Current date
```

so the user can control time.

---

# Task 9 — Animate Weather Observations

```javascript
let currentIndex = 0;
let timer = null;
```

Create a marker:

```javascript
const marker = svg.append("circle")
    .attr("r", 7)
    .attr("fill", "red");
```

Create date label:

```javascript
const dateLabel = svg.append("text")
    .attr("x", width - 160)
    .attr("y", 40)
    .attr("font-size", 20);
```

Show one frame:

```javascript
function showFrame(index) {

    const d = cityData[index];

    marker
        .attr(
            "cx",
            xScale(d.date)
        )
        .attr(
            "cy",
            yScale(d.temperature_c)
        );

    dateLabel.text(
        d3.timeFormat("%Y-%m-%d")(
            d.date
        )
    );

    d3.select("#time-slider")
        .property("value", index);
}
```

---

# Task 10 — Play, Pause, Reset, and Scrub

HTML:

```html
<button id="play">Play</button>
<button id="pause">Pause</button>
<button id="reset">Reset</button>

<input
    type="range"
    id="time-slider"
    min="0"
    max="179"
    value="0">
```

Play:

```javascript
function play() {

    if (timer) return;

    timer = d3.interval(
        () => {

            showFrame(currentIndex);

            currentIndex += 1;

            if (
                currentIndex >=
                cityData.length
            ) {
                pause();
            }

        },
        150
    );
}
```

Pause:

```javascript
function pause() {

    if (timer) {
        timer.stop();
        timer = null;
    }
}
```

Reset:

```javascript
function reset() {

    pause();

    currentIndex = 0;

    showFrame(0);
}
```

Connect controls:

```javascript
d3.select("#play")
    .on("click", play);

d3.select("#pause")
    .on("click", pause);

d3.select("#reset")
    .on("click", reset);

d3.select("#time-slider")
    .on("input", function() {

        pause();

        currentIndex =
            +this.value;

        showFrame(currentIndex);
    });
```

The important principle is:

> **Animation should be controllable.**

Users should be able to stop the animation and inspect a specific time point.

---

# Task 11 — Static vs. Animated Temporal Visualization

A line chart is useful for:

```text
overall trend
comparison
peaks
cycles
long-term change
```

Animation is useful for:

```text
evolution
appearance/disappearance
changing structure
movement
```

However, animation makes comparison across distant time points harder because the viewer must remember previous frames.

A useful design often combines:

```text
overview
+
animation
+
time controls
```

rather than relying on animation alone.

---

# Assignment — Animated Temporal Commercial Network

## Objective

Create an interactive temporal-network visualization showing how commercial transactions among companies evolve over **60 days**.

Unlike the weather tutorial, the assignment combines:

```text
Temporal data
+
Network data
+
Animation
```

The central question is:

> **How does the structure and connectivity of a commercial network change over time?**

---

# Assignment Dataset

Use two files:

```text
data/lab7_assignment_companies.csv
data/lab7_assignment_transactions_60days.csv
```

The data are **fabricated** for visualization practice. They do not represent real companies or transactions.

---

## Company Data

The network contains **12 companies**.

Each company is a node.

| Variable | Meaning |
|---|---|
| `id` | Company identifier |
| `company_name` | Company name |
| `sector` | Business sector |
| `region` | Broad geographic region |

Example:

```csv
id,company_name,sector,region
c01,Apex Textiles,Manufacturing,Asia
c02,BlueRiver Logistics,Logistics,Asia
c03,Cedar Retail,Retail,North America
```

Possible node encodings include:

```text
sector → color
region → shape or stroke
transaction volume → size
```

---

## Transaction Data

Each row represents commercial activity between two companies on a particular day.

| Variable | Meaning |
|---|---|
| `date` | Transaction date |
| `day` | Day number from 1–60 |
| `source` | First company |
| `target` | Second company |
| `amount_usd` | Transaction amount |
| `transaction_type` | Goods, shipping, components, materials, or services |
| `transaction_count` | Number of transactions represented by the record |

Example:

```csv
date,day,source,target,amount_usd,transaction_type,transaction_count
2026-01-01,1,c02,c03,11850,shipping,2
```

Treat the links as **undirected commercial relationships** for this assignment.

---

# Assignment Part A — Create a Temporal Node-Link Visualization

Use:

```javascript
d3.forceSimulation()
```

to create a network.

At each time step:

```text
current day
    ↓
filter transactions
    ↓
determine active links
    ↓
update network
    ↓
animate transition
```

A simple frame function might be:

```javascript
function showDay(day) {

    const currentLinks =
        transactions.filter(
            d => d.day === day
        );

    updateNetwork(
        companies,
        currentLinks
    );

    dateLabel.text(
        `Day ${day}`
    );
}
```

---


# Assignment Part B — Calculate Dynamic Node Activity

A useful temporal node attribute is current transaction volume.

For each company:

```javascript
function calculateVolume(
    companyId,
    currentLinks
) {

    return d3.sum(
        currentLinks.filter(
            d =>
                d.source === companyId ||
                d.target === companyId
        ),
        d => d.amount_usd
    );
}
```

Then:

```javascript
node.attr(
    "r",
    d =>
        sizeScale(
            calculateVolume(
                d.id,
                currentLinks
            )
        )
);
```

Now node size changes over time.

This allows the visualization to show not only:

```text
Who is connected?
```

but also:

```text
Who is commercially active right now?
```

---

# Assignment Part C — Controllable Animation

Your animation must include:

```text
Play
Pause
Reset
Time slider
Current day/date
```

The network changes because relationships appear and disappear.

Use D3's join:

```javascript
const link = linkGroup
    .selectAll("line")
    .data(
        currentLinks,
        d =>
            `${d.source}-${d.target}`
    )
    .join(
        enter =>
            enter
            .append("line")
            .attr("opacity", 0)
            .call(
                enter =>
                    enter
                    .transition()
                    .duration(400)
                    .attr("opacity", 0.7)
            ),

        update =>
            update,

        exit =>
            exit
            .transition()
            .duration(400)
            .attr("opacity", 0)
            .remove()
    );
```

This makes:

```text
new relationship
→ fade in

disappearing relationship
→ fade out
```

The animation now communicates changes in network connectivity rather than simply moving nodes.

---

# Assignment Part D — Preserve the Mental Map

A major problem in animated network visualization is that force-directed nodes can move too much.

If every frame completely rearranges the graph:

```text
Day 10
A is here

Day 11
A suddenly moves elsewhere
```

the viewer may lose track of nodes.

Try to preserve the **mental map**.

Possible strategies:

```text
Keep the same node objects across frames

Do not rebuild all nodes every frame

Restart the simulation gently

Use stable positions when possible

Use fixed/group-based forces

Allow users to pause and inspect
```

For example:

```javascript
simulation
    .nodes(companies)
    .alpha(0.3)
    .restart();
```

rather than recreating a completely new simulation for every day.


Consider showing temporal changes explicitly.

Possible techniques:

```text
New link
→ stronger opacity briefly

Disappearing link
→ fade out

High current transaction volume
→ larger node

Recently active node
→ stronger outline

Current day
→ prominent label
```

You may also provide a small summary:

```text
Day 32

Active companies: 10
Active links: 7
Total transaction value: $142,000
```

Calculate:

```javascript
const totalValue =
    d3.sum(
        currentLinks,
        d => d.amount_usd
    );

const activeCompanies =
    new Set(
        currentLinks.flatMap(
            d => [
                d.source,
                d.target
            ]
        )
    ).size;
```

---


# Assignment Part E — Temporal Network Questions

Use your visualization to investigate the following questions:

```text
1. How does overall network connectivity change
   across the 60 days?

2. Which companies become more central or
   commercially active over time?

3. Are there periods when the network consists
   of relatively separate clusters?

4. Which commercial relationships appear,
   disappear, or become stronger over time?

5. Does the network become more or less
   cross-regional over time?
```

Your answers can be based on visual observations supported by your encodings and interaction.

---


# Assignment Requirements

1. Use the provided company and transaction datasets.
2. Visualize all 60 days.
3. Use D3 to create the network.
4. Use `d3.forceSimulation()`.
5. Encode at least two company attributes or dynamic node properties.
6. Encode at least two transaction/link properties.
7. Update network links as time changes.
8. Show entering/disappearing relationships.
9. Provide Play, Pause, Reset.
10. Provide a 60-day time slider.
11. Display the current day/date.
12. Allow users to inspect a specific time manually.
13. Include node and/or link tooltips.
14. Make a reasonable effort to preserve the mental map.
15. Include a legend or encoding explanation.
16. Address the temporal-network questions.
---

# What to Submit

Submit **one GitHub Pages link** that directly opens your Lab 7 assignment.

Example:

```text
https://yourusername.github.io/stats401-labs/lab7/
```

---

# Submission Checklist


- [ ] My visualization covers all 60 days.
- [ ] The network changes when time changes.
- [ ] New links can appear.
- [ ] Inactive links can disappear.
- [ ] My visualization has a Play control.
- [ ] The current day/date is visible.
- [ ] I can manually inspect a particular day.
- [ ] I include tooltips.
- [ ] I provide a legend or encoding explanation.
- [ ] I address the provided temporal-network questions.

---
