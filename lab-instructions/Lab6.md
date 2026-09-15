# Lab 6 — Hierarchical Data Visualization: Trees and Treemaps

**STATS 401: Data Acquisition and Visualization**

## Learning Objectives

By the end of this lab, you should be able to:

1. Explain how flat tabular data can represent hierarchical relationships.
2. Convert flat tabular data into hierarchical JSON using Python.
3. Use `d3.hierarchy()` to create a hierarchy in D3.
4. Create a node-link tree with `d3.tree()`.
5. Create a treemap with `d3.treemap()`.
6. Encode quantitative attributes with area or size.
7. Encode categorical/status information with color.
8. Add tooltips and basic interaction such as expanding/collapsing a tree or zooming into a treemap.
9. Compare different treemap segmentation strategies.

---

# 0. What Is Hierarchical Data?

Hierarchical data contains **parent–child relationships**.

Examples include:

```text
File systems
Organization charts
Taxonomies
Geographic regions
Product categories
Website structure
Countries and regions
```

A hierarchy can be represented as a tree:

```text
World
├── Asia
│   ├── Japan
│   │   ├── Kanto
│   │   │   └── Tokyo
│   │   └── Kansai
│   │       └── Osaka
│   └── South Korea
│       └── Seoul
└── Europe
    ├── Germany
    └── France
```

Two common visual representations are:

```text
Node-link tree
Treemap
```

A **tree** emphasizes:

```text
parent–child relationships
depth
branching structure
```

A **treemap** emphasizes:

```text
part-to-whole relationships
relative quantitative values
hierarchical grouping
```

---

# Task 1 — Flat Tabular Hierarchical Data

Use the provided file:

```text
data/lab6_small_hierarchy.csv
```

It contains a small geographic hierarchy:

```csv
root,continent,country,region,city,population_thousands
World,North America,USA,California,Los Angeles,3900
World,North America,USA,California,San Francisco,870
World,North America,USA,New York,New York City,8400
World,North America,Canada,Ontario,Toronto,2900
World,North America,Canada,British Columbia,Vancouver,675
World,Europe,Germany,Bavaria,Munich,1500
World,Europe,Germany,Berlin,Berlin,3700
World,Europe,France,Île-de-France,Paris,2100
World,Europe,France,Auvergne-Rhône-Alpes,Lyon,520
World,Asia,Japan,Kanto,Tokyo,14000
World,Asia,Japan,Kansai,Osaka,2750
World,Asia,South Korea,Seoul,Seoul,9500
```

The hierarchy is:

```text
root
 ↓
continent
 ↓
country
 ↓
region
 ↓
city
```

The quantitative value is:

```text
population_thousands
```

---

# Task 2 — Convert Flat Data to Hierarchical JSON with Python

D3 hierarchical layouts work naturally with nested JSON.

A desired structure looks like:

```json
{
  "name": "World",
  "children": [
    {
      "name": "Asia",
      "children": [
        {
          "name": "Japan",
          "children": [
            {
              "name": "Kanto",
              "children": [
                {
                  "name": "Tokyo",
                  "value": 14000
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Create:

```text
lab6/convert_hierarchy.py
```

Use:

```python
import pandas as pd
import json

df = pd.read_csv(
    "../data/lab6_small_hierarchy.csv"
)
```

Create a recursive hierarchy:

```python
def build_hierarchy(
    dataframe,
    levels,
    value_column
):

    if len(levels) == 1:

        return [
            {
                "name": row[levels[0]],
                "value": row[value_column]
            }
            for _, row
            in dataframe.iterrows()
        ]

    current_level = levels[0]

    children = []

    for value, group in dataframe.groupby(
        current_level
    ):

        children.append({
            "name": value,
            "children": build_hierarchy(
                group,
                levels[1:],
                value_column
            )
        })

    return children
```

Build the hierarchy:

```python
hierarchy = {
    "name": "World",
    "children": build_hierarchy(
        df,
        [
            "continent",
            "country",
            "region",
            "city"
        ],
        "population_thousands"
    )
}
```

Save:

```python
with open(
    "../data/lab6_small_hierarchy.json",
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        hierarchy,
        f,
        indent=2,
        ensure_ascii=False
    )
```

Now the workflow is:

```text
Flat CSV
   ↓
Python groupby()
   ↓
Nested dictionaries
   ↓
Hierarchical JSON
   ↓
D3 hierarchy
```

---

# Task 3 — Load Hierarchical JSON in D3

Create:

```text
lab6/index.html
lab6/lab6.js
```

In HTML:

```html
<div id="tree"></div>
<div id="treemap"></div>

<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
<script src="lab6.js"></script>
```

Load the JSON:

```javascript
d3.json(
    "../data/lab6_small_hierarchy.json"
)
.then(data => {

    console.log(data);

});
```

---

# Task 4 — Create a D3 Hierarchy

D3 uses:

```javascript
d3.hierarchy()
```

Create:

```javascript
const root = d3.hierarchy(data);
```

Inspect:

```javascript
console.log(root);
```

A D3 hierarchy node contains useful properties such as:

```text
data
parent
children
depth
height
value
```

For example:

```javascript
console.log(
    root.descendants()
);
```

This returns all nodes in the hierarchy.

---

# Task 5 — Aggregate Values with `.sum()`

Treemaps need quantitative values.

Use:

```javascript
root.sum(
    d => d.value || 0
);
```

This calculates values upward through the hierarchy.

For example:

```text
Tokyo = 14000
Osaka = 2750
        ↓
Japan = 16750
```

The parent receives the sum of its descendants.

Inspect:

```javascript
console.log(
    root.value
);
```

---

# Task 6 — Create a Tree Layout

A tree layout calculates x/y positions.

```javascript
const width = 1000;
const height = 650;

const treeLayout = d3.tree()
    .size([
        height - 100,
        width - 250
    ]);
```

Apply:

```javascript
treeLayout(root);
```

Now each hierarchy node has:

```text
node.x
node.y
```

---

# Task 7 — Draw Tree Links

Create an SVG:

```javascript
const treeSvg = d3.select(
    "#tree"
)
.append("svg")
.attr("width", width)
.attr("height", height);
```

Create a group:

```javascript
const treeGroup = treeSvg
    .append("g")
    .attr(
        "transform",
        "translate(100,50)"
    );
```

Draw links:

```javascript
treeGroup
    .selectAll(".link")
    .data(
        root.links()
    )
    .join("path")
    .attr(
        "class",
        "link"
    )
    .attr(
        "fill",
        "none"
    )
    .attr(
        "stroke",
        "#999"
    )
    .attr(
        "d",
        d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x)
    );
```

`root.links()` returns:

```text
source → parent
target → child
```

---

# Task 8 — Draw Tree Nodes

Create node groups:

```javascript
const nodes = treeGroup
    .selectAll(".node")
    .data(
        root.descendants()
    )
    .join("g")
    .attr(
        "class",
        "node"
    )
    .attr(
        "transform",
        d =>
            `translate(
                ${d.y},
                ${d.x}
            )`
    );
```

Add circles:

```javascript
nodes.append("circle")
    .attr("r", 6)
    .attr(
        "fill",
        d =>
            d.children
            ? "steelblue"
            : "orange"
    );
```

Add labels:

```javascript
nodes.append("text")
    .attr("x", 10)
    .attr("dy", "0.35em")
    .text(
        d => d.data.name
    );
```

---


# Task 9 — Expand and Collapse Tree Nodes

A useful interaction is clicking a node to hide/show its children.

First store hidden children in:

```javascript
d._children
```

A simple click handler is:

```javascript
function toggleNode(
    event,
    d
) {

    if (d.children) {

        d._children =
            d.children;

        d.children = null;

    } else {

        d.children =
            d._children;

        d._children = null;
    }

    updateTree();
}
```

Attach:

```javascript
nodes.on(
    "click",
    toggleNode
);
```

To fully support expand/collapse, place the drawing code inside an `updateTree()` function so the layout and elements are recalculated after each click.

Conceptually:

```text
Before click:

Japan
├── Kanto
└── Kansai

After click:

Japan
```

Click again:

```text
Japan
├── Kanto
└── Kansai
```

---

# Task 10 — Create a Treemap

A treemap uses nested rectangles.

Create a new hierarchy:

```javascript
const treemapRoot =
    d3.hierarchy(data)
    .sum(
        d => d.value || 0
    )
    .sort(
        (a, b) =>
            b.value - a.value
    );
```

Create a layout:

```javascript
const treemapWidth = 900;
const treemapHeight = 550;

const treemapLayout =
    d3.treemap()
    .size([
        treemapWidth,
        treemapHeight
    ])
    .paddingInner(2)
    .paddingOuter(4);
```

Apply:

```javascript
treemapLayout(
    treemapRoot
);
```

Each node now has:

```text
x0
x1
y0
y1
```

These define the rectangle boundaries.

---

# Task 11 — Draw Treemap Rectangles

Create:

```javascript
const treemapSvg =
    d3.select("#treemap")
    .append("svg")
    .attr(
        "width",
        treemapWidth
    )
    .attr(
        "height",
        treemapHeight
    );
```

Use only leaf nodes:

```javascript
const leaves =
    treemapRoot.leaves();
```

Create groups:

```javascript
const cell =
    treemapSvg
    .selectAll(".cell")
    .data(leaves)
    .join("g")
    .attr(
        "class",
        "cell"
    )
    .attr(
        "transform",
        d =>
            `translate(
                ${d.x0},
                ${d.y0}
            )`
    );
```

Draw rectangles:

```javascript
cell.append("rect")
    .attr(
        "width",
        d => d.x1 - d.x0
    )
    .attr(
        "height",
        d => d.y1 - d.y0
    )
    .attr(
        "fill",
        "steelblue"
    );
```

Add labels:

```javascript
cell.append("text")
    .attr("x", 5)
    .attr("y", 18)
    .text(
        d => d.data.name
    );
```

---

# Task 12 — Encode Continent with Color

Find the top-level ancestor under the root.

Create a helper:

```javascript
function getContinent(d) {

    let current = d;

    while (
        current.depth > 1
    ) {
        current = current.parent;
    }

    return current.data.name;
}
```

Create colors:

```javascript
const continents = [
    "North America",
    "Europe",
    "Asia"
];

const colorScale =
    d3.scaleOrdinal()
    .domain(continents)
    .range(
        d3.schemeTableau10
    );
```

Apply:

```javascript
cell.select("rect")
    .attr(
        "fill",
        d =>
            colorScale(
                getContinent(d)
            )
    );
```

Now:

```text
rectangle area → population
rectangle color → continent
```

---


# Task 13 — Add Treemap Tooltips

Add HTML:

```html
<div
    id="tooltip"
    class="tooltip">
</div>
```

CSS:

```css
.tooltip {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    background: white;
    border: 1px solid #aaa;
    padding: 8px 10px;
    border-radius: 4px;
}
```

JavaScript:

```javascript
const tooltip =
    d3.select("#tooltip");
```

Add:

```javascript
cell
    .on(
        "mouseover",
        function(event, d) {

            tooltip
                .style(
                    "opacity",
                    1
                )
                .html(`
                    <strong>
                        ${d.data.name}
                    </strong>
                    <br>
                    Population:
                    ${d.value}
                    thousand
                `);
        }
    )
    .on(
        "mousemove",
        function(event) {

            tooltip
                .style(
                    "left",
                    `${event.pageX + 10}px`
                )
                .style(
                    "top",
                    `${event.pageY + 10}px`
                );
        }
    )
    .on(
        "mouseout",
        function() {

            tooltip.style(
                "opacity",
                0
            );
        }
    );
```

---

# Task 14 — Zooming into a Treemap

Treemaps can become difficult to read when there are many levels.

One strategy is to let users zoom into a selected parent.

Conceptually:

```text
World treemap
      ↓ click Asia
Asia fills the entire view
      ↓ click Japan
Japan fills the entire view
```

A simple implementation can update the x/y scales based on the clicked node:

```javascript
function zoomTo(d) {

    x.domain([
        d.x0,
        d.x1
    ]);

    y.domain([
        d.y0,
        d.y1
    ]);

    cells.transition()
        .duration(600)
        .attr(
            "transform",
            node =>
                `translate(
                    ${x(node.x0)},
                    ${y(node.y0)}
                )`
        );

    cells.select("rect")
        .transition()
        .duration(600)
        .attr(
            "width",
            node =>
                x(node.x1) -
                x(node.x0)
        )
        .attr(
            "height",
            node =>
                y(node.y1) -
                y(node.y0)
        );
}
```

A full zoomable treemap requires a little more code to manage navigation back to parent nodes, but the main idea is:

```text
Interaction changes which hierarchical level occupies the available display space.
```

---

# Task 15 — Different Treemap Segmentation Methods

D3 supports different tiling/segmentation algorithms.

Examples include:

```javascript
d3.treemapSquarify
d3.treemapBinary
d3.treemapSlice
d3.treemapDice
d3.treemapSliceDice
```

Use:

```javascript
const layout =
    d3.treemap()
    .tile(
        d3.treemapSquarify
    )
    .size([
        width,
        height
    ]);
```

or:

```javascript
const layout =
    d3.treemap()
    .tile(
        d3.treemapBinary
    )
    .size([
        width,
        height
    ]);
```

or:

```javascript
const layout =
    d3.treemap()
    .tile(
        d3.treemapSliceDice
    )
    .size([
        width,
        height
    ]);
```

Different tiling strategies produce different rectangle shapes and spatial organizations.

For example:

```text
Squarify
→ tries to produce rectangles with aspect ratios closer to squares

Binary
→ recursively divides available space into two groups

Slice/Dice
→ repeatedly partitions along one direction

SliceDice
→ alternates horizontal and vertical subdivision by hierarchy depth
```

The hierarchy and values remain the same; only the spatial segmentation strategy changes.

---

# Assignment — GDP Hierarchy with Two Treemaps

## Objective

Create **two different treemap visualizations** of a hierarchical GDP dataset.

Both treemaps should visualize:

```text
Continent
  ↓
Area
  ↓
Country
```

and encode:

```text
GDP amount
GDP status
```

The two treemaps must use **different treemap segmentation methods**.

---

# Assignment Dataset

Use:

```text
data/lab6_assignment_gdp.csv
```

The dataset is synthetic and intended for visualization practice.

It contains:

| Variable | Meaning |
|---|---|
| `continent` | Continent |
| `area` | Subregion within the continent |
| `country` | Country |
| `gdp_billion_usd` | GDP in billions of U.S. dollars |
| `gdp_status` | Whether GDP increased, stayed unchanged, or decreased |

Example:

```csv
continent,area,country,gdp_billion_usd,gdp_status
Asia,East Asia,China,17960,Increase
Asia,East Asia,Japan,4210,Decrease
Asia,East Asia,South Korea,1710,Increase
```

The hierarchy is:

```text
World
  ↓
Continent
  ↓
Area
  ↓
Country
```

The two key attributes are:

```text
GDP amount
GDP status
```

GDP status has three values:

```text
Increase
Unchanged
Decrease
```

---

# Assignment Part A — Convert the Flat Data to Hierarchical JSON

Use Python to convert:

```text
continent
area
country
```

into nested JSON.

The result should conceptually look like:

```json
{
  "name": "World",
  "children": [
    {
      "name": "Asia",
      "children": [
        {
          "name": "East Asia",
          "children": [
            {
              "name": "China",
              "gdp": 17960,
              "status": "Increase"
            }
          ]
        }
      ]
    }
  ]
}
```

Make sure the leaf nodes preserve both:

```text
gdp
status
```

---

# Assignment Part B — Treemaps


The two treemaps must differ in the spatial subdivision strategy.


Both treemaps must encode:

```text
GDP amount
GDP status
```

A tooltip may show:

```text
country
continent
area
GDP
GDP status
```

---

# Assignment Part C — Design Description

Under the visualizations, write approximately **100–200 words** explaining your design.

Discuss:

1. **Why you chose those visual channels.**
2. **How the two segmentation strategies change the appearance/readability of the hierarchy.**

---

# Assignment Requirements

1. Use the provided GDP dataset.
2. Convert the flat CSV into hierarchical JSON using Python.
3. Use two different D3 treemap tiling/segmentation methods.
4. Encode GDP amount and GDP status in both treemaps.
5. Make continent/area/country hierarchy understandable.
6. Include tooltips.
7. Include a legend explaining GDP status.
8. Add a 100–200 word design description.

---

# What to Submit

Submit **one GitHub Pages link** that directly opens your Lab 6 assignment.

Example:

```text
https://yourusername.github.io/stats401-labs/lab6/
```

Your repository should also include:

```text
Hierarchical JSON file
D3 code
```

---

# Submission Checklist

- [ ] I convert the flat CSV into hierarchical JSON using Python.
- [ ] I create two treemap visualizations.
- [ ] The two treemaps use different segmentation methods.
- [ ] My visualizations include appropriate labels.
- [ ] My visualizations include tooltips.
- [ ] I provide a legend for GDP status.
- [ ] I include a 100–200 word design description.
