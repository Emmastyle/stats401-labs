# Lab 2 — Multivariate Visualization with D3

**STATS 401: Data Acquisition and Visualization**

## Learning Objectives

By the end of this lab, you should be able to:

1. Explain what multivariate data is.
2. Create D3 scales and axes.
3. Add legends and simple tooltips.
4. Design a visualization containing four dimensions and briefly justify your design.

---

# 0. Preparation

This lab continues the website you created in **Lab 1**.

Recommended structure:

```text
stats401-labs/
│
├── index.html
├── css/
│   └── style.css
├── data/
│   ├── students_multivariate.csv
│   └── cities_multivariate.csv
├── lab1/
│   ├── index.html
│   └── lab1.js
├── lab2/
│   ├── index.html
│   └── lab2.js
├── lab3/
├── lab4/
├── lab5/
├── lab6/
├── lab7/
├── lab8/
├── lab9/
└── lab10/
```

Your main navigation should contain a working **Lab 2** tab.

---

# Task 1 — Understanding Multivariate Data

A dataset is **multivariate** when each observation contains multiple variables.

Example:

```csv
name,study_hours,score,major,year
Alice,8,90,Computer Science,Senior
Bob,5,76,Economics,Sophomore
Carol,7,84,Data Science,Junior
```

Each row is one student, but each student has several properties:

```text
name
study_hours
score
major
year
```

The key question is:

> How should each variable be represented visually?

A scatterplot can encode several variables at the same time:

```text
study_hours → x-position
score       → y-position
major       → color
year        → size
```

---

# Task 2 — Create a Basic Multivariate Dataset

Create:

```text
data/students_multivariate.csv
```

with:

```csv
name,study_hours,score,major,year
Alice,8,90,Computer Science,Senior
Bob,5,76,Economics,Sophomore
Carol,7,84,Data Science,Junior
David,3,65,Biology,Freshman
Emma,9,94,Computer Science,Senior
Frank,6,78,Economics,Junior
Grace,10,97,Data Science,Senior
Henry,4,70,Biology,Sophomore
Ivy,7.5,88,Computer Science,Junior
Jack,2.5,61,Economics,Freshman
```

We will map:

```text
study_hours → x-position
score       → y-position
major       → color
year        → size
```

---

# Task 3 — Create the Lab 2 Page

Create:

```text
lab2/index.html
```

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport"
          content="width=device-width, initial-scale=1.0">

    <title>Lab 2 - Multivariate Visualization</title>

    <link rel="stylesheet"
          href="../css/style.css">
</head>

<body>

<header>
    <h1>STATS 401</h1>
    <p>Data Acquisition and Visualization</p>
</header>

<nav class="lab-nav">
    <a href="../lab1/index.html">Lab 1</a>
    <a href="../lab2/index.html">Lab 2</a>
    <a href="../lab3/index.html">Lab 3</a>
    <a href="../lab4/index.html">Lab 4</a>
    <a href="../lab5/index.html">Lab 5</a>
    <a href="../lab6/index.html">Lab 6</a>
    <a href="../lab7/index.html">Lab 7</a>
    <a href="../lab8/index.html">Lab 8</a>
    <a href="../lab9/index.html">Lab 9</a>
    <a href="../lab10/index.html">Lab 10</a>
</nav>

<main>
    <h2>Lab 2: Multivariate Visualization with D3</h2>

    <p>
        This visualization explores the relationship among
        study hours, exam score, major, and year level.
    </p>

    <div id="chart"></div>
    <div id="tooltip" class="tooltip"></div>
</main>

<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
<script src="lab2.js"></script>

</body>
</html>
```

---

# Task 4 — Load and Process the Data

Create:

```text
lab2/lab2.js
```

Start with:

```javascript
const width = 800;
const height = 500;

const margin = {
    top: 40,
    right: 170,
    bottom: 70,
    left: 70
};
```

Load the CSV:

```javascript
d3.csv("../data/students_multivariate.csv", d => ({
    name: d.name,
    study_hours: +d.study_hours,
    score: +d.score,
    major: d.major,
    year: d.year
}))
.then(data => {
    console.log(data);
});
```

The `+` converts CSV strings into numbers.

---

# Task 5 — D3 Scales

A D3 scale maps a **data domain** to a **visual range**.

```text
Data value
   ↓
D3 scale
   ↓
Pixel position / size / color
```

## 6.1 X Scale

```javascript
const xScale = d3.scaleLinear()
    .domain(d3.extent(data, d => d.study_hours))
    .nice()
    .range([
        margin.left,
        width - margin.right
    ]);
```

`d3.extent()` returns:

```text
[min, max]
```

## 6.2 Y Scale

```javascript
const yScale = d3.scaleLinear()
    .domain(d3.extent(data, d => d.score))
    .nice()
    .range([
        height - margin.bottom,
        margin.top
    ]);
```

The y-range is reversed because SVG coordinates increase downward.

---

# Task 6 — Create Axes

Create the SVG:

```javascript
const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);
```

Add the x-axis:

```javascript
svg.append("g")
    .attr(
        "transform",
        `translate(0, ${height - margin.bottom})`
    )
    .call(d3.axisBottom(xScale));
```

Add the y-axis:

```javascript
svg.append("g")
    .attr(
        "transform",
        `translate(${margin.left}, 0)`
    )
    .call(d3.axisLeft(yScale));
```

Add axis labels:

```javascript
svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 20)
    .attr("text-anchor", "middle")
    .text("Study Hours");

svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .text("Exam Score");
```

---

# Task 7 — Draw a Scatterplot

Create one circle per student:

```javascript
svg.selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", d => xScale(d.study_hours))
    .attr("cy", d => yScale(d.score))
    .attr("r", 7)
    .attr("fill", "steelblue");
```

Now the visualization encodes:

```text
study_hours → x-position
score       → y-position
```

---

# Task 8 — Encode a Variable with Color

Find the unique majors:

```javascript
const majors = Array.from(
    new Set(data.map(d => d.major))
);
```

Create a categorical color scale:

```javascript
const colorScale = d3.scaleOrdinal()
    .domain(majors)
    .range(d3.schemeTableau10);
```

Then use:

```javascript
.attr("fill", d => colorScale(d.major))
```

Now:

```text
major → color
```

---

# Task 9 — Encode Another Variable with Size

Create an ordinal size scale:

```javascript
const sizeScale = d3.scaleOrdinal()
    .domain([
        "Freshman",
        "Sophomore",
        "Junior",
        "Senior"
    ])
    .range([
        5,
        7,
        9,
        11
    ]);
```

Use it for circle radius:

```javascript
.attr("r", d => sizeScale(d.year))
```

Now each point represents four variables:

```text
study_hours → x-position
score       → y-position
major       → color
year        → size
```

---

# Task 10 — Add a Legend

A legend explains the color encoding.

```javascript
const legend = svg.append("g")
    .attr(
        "transform",
        `translate(${width - margin.right + 25}, 60)`
    );
```

Create one legend item per major:

```javascript
const legendItems = legend
    .selectAll(".legend-item")
    .data(majors)
    .join("g")
    .attr("class", "legend-item")
    .attr(
        "transform",
        (d, i) => `translate(0, ${i * 28})`
    );
```

Add color symbols:

```javascript
legendItems.append("circle")
    .attr("r", 6)
    .attr("fill", d => colorScale(d));
```

Add text:

```javascript
legendItems.append("text")
    .attr("x", 12)
    .attr("y", 4)
    .text(d => d);
```

---

# Task 11 — Add Tooltips

Add CSS:

```css
.tooltip {
    position: absolute;
    background: white;
    border: 1px solid #aaa;
    padding: 8px 10px;
    border-radius: 4px;
    pointer-events: none;
    opacity: 0;
    font-size: 14px;
}
```

Select the tooltip:

```javascript
const tooltip = d3.select("#tooltip");
```

Add mouse events to your circles:

```javascript
.on("mouseover", function(event, d) {

    tooltip
        .style("opacity", 1)
        .html(`
            <strong>${d.name}</strong><br>
            Study Hours: ${d.study_hours}<br>
            Score: ${d.score}<br>
            Major: ${d.major}<br>
            Year: ${d.year}
        `);

})
.on("mousemove", function(event) {

    tooltip
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`);

})
.on("mouseout", function() {

    tooltip
        .style("opacity", 0);

});
```

Tooltips let the viewer inspect detailed values without placing too much text directly on the chart.

---

# Task 12 — Complete Scatterplot Example

A simplified complete `lab2.js` can look like this:

```javascript
const width = 800;
const height = 500;

const margin = {
    top: 40,
    right: 170,
    bottom: 70,
    left: 70
};

const tooltip = d3.select("#tooltip");

d3.csv(
    "../data/students_multivariate.csv",
    d => ({
        name: d.name,
        study_hours: +d.study_hours,
        score: +d.score,
        major: d.major,
        year: d.year
    })
)
.then(data => {

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.study_hours))
        .nice()
        .range([
            margin.left,
            width - margin.right
        ]);

    const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.score))
        .nice()
        .range([
            height - margin.bottom,
            margin.top
        ]);

    const majors = Array.from(
        new Set(data.map(d => d.major))
    );

    const colorScale = d3.scaleOrdinal()
        .domain(majors)
        .range(d3.schemeTableau10);

    const sizeScale = d3.scaleOrdinal()
        .domain([
            "Freshman",
            "Sophomore",
            "Junior",
            "Senior"
        ])
        .range([5, 7, 9, 11]);

    svg.append("g")
        .attr(
            "transform",
            `translate(0, ${height - margin.bottom})`
        )
        .call(d3.axisBottom(xScale));

    svg.append("g")
        .attr(
            "transform",
            `translate(${margin.left}, 0)`
        )
        .call(d3.axisLeft(yScale));

    svg.selectAll(".student-point")
        .data(data)
        .join("circle")
        .attr("class", "student-point")
        .attr(
            "cx",
            d => xScale(d.study_hours)
        )
        .attr(
            "cy",
            d => yScale(d.score)
        )
        .attr(
            "r",
            d => sizeScale(d.year)
        )
        .attr(
            "fill",
            d => colorScale(d.major)
        )
        .attr("opacity", 0.8)
        .on("mouseover", function(event, d) {

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.name}</strong><br>
                    Study Hours: ${d.study_hours}<br>
                    Score: ${d.score}<br>
                    Major: ${d.major}<br>
                    Year: ${d.year}
                `);
        })
        .on("mousemove", function(event) {

            tooltip
                .style(
                    "left",
                    `${event.pageX + 10}px`
                )
                .style(
                    "top",
                    `${event.pageY + 10}px`
                );
        })
        .on("mouseout", function() {

            tooltip
                .style("opacity", 0);
        });
});
```

<img width="1334" height="1156" alt="image" src="https://github.com/user-attachments/assets/021d6024-4cfa-405c-9014-e004bce95f5d" />


---

# Assignment — Design a Four-Dimensional Visualization

## Objective

Design and implement a D3 visualization for a dataset containing **four variables**, with one variable from each measurement type:

```text
Ratio
Nominal
Interval
Ordinal
```

Your task is to decide how to map the variables to visual channels.

The main goal is to practice:

```text
Data type
   ↓
Visual encoding decision
   ↓
D3 implementation
   ↓
Design justification
```

For this assignment, grading will **not focus on whether your mapping is theoretically optimal**.

Instead, you should:

1. make a clear design choice;
2. implement it correctly;
3. briefly explain your reasoning.

---

## Assignment Dataset

Create:

```text
data/cities_multivariate.csv
```

with:

```csv
city,population,temp_c,development_level,region
Aurora,1.2,16.5,High,North
Bayside,0.7,21.0,Medium,South
Cedar,2.1,13.5,High,West
Dover,0.5,24.5,Low,South
Elmwood,1.6,18.0,Medium,East
Fairview,2.8,10.5,High,North
Glenville,0.9,26.0,Low,West
Harbor,1.9,19.5,Medium,East
Ivydale,3.2,12.0,High,West
Juniper,0.6,22.5,Low,South
Kingston,1.4,17.0,Medium,North
Lakeside,2.4,15.0,High,East
```

The four dimensions are:

| Variable | Type | Description |
|---|---|---|
| `population` | Ratio | Population in millions |
| `temp_c` | Interval | Average temperature in Celsius |
| `development_level` | Ordinal | Low, Medium, High |
| `region` | Nominal | North, South, East, West |

`city` identifies each observation but is not one of the four required dimensions.

---

## Assignment Task

Create a D3 visualization representing all four required variables:

```text
population
temp_c
development_level
region
```

You may choose any reasonable mapping.

For example:

```text
population          → x-position
temperature         → y-position
development_level   → size
region              → color
```

This is only one possibility.

Other visual channels include:

```text
x-position
y-position
size
color
shape
opacity
stroke
grouping
```

The goal is to **Attempt to map the four dimensions onto one or more visualisations. Visualisations other than scatter plots are preferred.**.

---

## Important Note About Assessment

You will **not lose points because your mapping is not the theoretically best mapping**.

The assignment is intended to help you practice making visualization design decisions.

You will be assessed primarily on whether:

- all four variables are represented;
- the D3 implementation works;
- the visualization is understandable;
- your design choices are briefly justified.

---

## Design Justification

Under your visualization, add a section titled:

```text
Design Justification
```

Write approximately **100–200 words**.

Explain:

1. which variable you mapped to each visual channel;
2. why you chose those mappings;
3. what you hope viewers can notice from the visualization.


---

# Assignment Requirements

1. Use the provided `cities_multivariate.csv` dataset.
2. Load the dataset using `d3.csv(...)`.
3. Convert `population` and `temp_c` to numbers.
4. Use D3.js to create the visualization.
5. Represent all four variables:
6. Allow the viewer to identify each city using labels or tooltips.
7. Add a **Design Justification** under the visualization.


---

# Submission Requirements

Submit **one GitHub Pages link** that directly opens your Lab 2 assignment.

Example:

```text
https://yourusername.github.io/stats401-labs/lab2/
```

The page should contain:

```text
Visualization
+
Design Justification
```

---

# Submission Checklist

- [ ] My Lab 2 page opens successfully through GitHub Pages.
- [ ] Lab 2 is accessible from the website navigation.
- [ ] I use the provided `cities_multivariate.csv` dataset.
- [ ] I load the CSV using D3.
- [ ] I convert `population` and `temp_c` to numbers.
- [ ] My visualization represents `population`.
- [ ] My visualization represents `temp_c`.
- [ ] My visualization represents `development_level`.
- [ ] My visualization represents `region`.
- [ ] The viewer can identify individual cities.
- [ ] I include a Design Justification below the visualization.

---
