# Lab 5 — Interactive Network Visualization with D3

**STATS 401: Data Acquisition and Visualization**

## Learning Objectives

By the end of this lab, you should be able to:

1. Explain the node-link data structure used to represent networks.
2. Load separate node and link tables with D3.
3. Create a force-directed network using `d3.forceSimulation()`.
4. Encode node attributes with size and color.
5. Encode link attributes with width and color/style.
6. Add node dragging, highlighting, and tooltips.
7. Build a simple adjacency matrix from the same network data.
8. Evaluate which network questions can be answered using node-link diagrams and adjacency matrices.

---

# 0. Network Data and Dataset Background

A network represents a set of **entities** and the **relationships between them**.

Examples include:

```text
People connected by friendship
Researchers connected by collaboration
Airports connected by flights
Webpages connected by hyperlinks
Stations connected by transit routes
```

A network is usually represented using two tables:

```text
Nodes
+
Links
```

The **node table** describes the entities. The **link table** describes relationships between pairs of entities.

---

## 0.1 Guided Example: University Collaboration Network

For the tutorial tasks, imagine a small interdisciplinary university project team with 10 members.

Each person belongs to one broad unit:

```text
Research
Design
Engineering
```

People interact through several kinds of professional relationships:

```text
collaboration
communication
advice
```

The dataset is **synthetic** and created only for this lab. It is small enough that you can inspect every node and link while learning how a force-directed layout works.

Use:

```text
data/lab5_small_nodes.csv
data/lab5_small_links.csv
```

### Node Semantics

The node table contains:

| Variable | Meaning |
|---|---|
| `id` | Unique person identifier |
| `name` | Person's name |
| `group` | Broad university/project unit |
| `activity_count` | Number of recorded project activities/interactions during the observation period |
| `level` | Ordered seniority/experience level from 1 to 4 |

Example:

```csv
id,name,group,activity_count,level
n1,Alice,Research,42,1
n2,Bob,Research,31,2
n3,Carol,Design,28,2
```

Here:

```text
Alice
→ belongs to Research
→ has 42 recorded activities
→ has level 1
```

The exact interpretation of `level` is intentionally simple. You can think of it as an ordered experience category:

```text
1 → most senior
2
3
4 → most junior
```

### Link Semantics

The link table contains:

| Variable | Meaning |
|---|---|
| `source` | Starting node ID |
| `target` | Ending node ID |
| `weight` | Strength/frequency of the relationship |
| `type` | Type of professional relationship |

Example:

```csv
source,target,weight,type
n1,n2,8,collaboration
n1,n3,5,collaboration
n1,n5,9,advice
```

For example:

```text
n1 → n2
weight = 8
type = collaboration
```

means Alice and Bob have a relatively strong collaboration relationship.

For this tutorial, treat the network as **undirected**:

```text
Alice — Bob
```

means the same connection as:

```text
Bob — Alice
```

The `source` and `target` columns are therefore used to store the pair, not to imply causal direction.

---

## 0.2 Why Use a Node-Link Diagram?

A node-link diagram directly represents:

```text
Node → entity
Link → relationship
```

This makes it useful for tasks such as:

```text
Who is connected to whom?
Which nodes have many neighbors?
Are there visible groups or clusters?
Which nodes connect different groups?
What paths exist between nodes?
```

However, as a network becomes larger or denser, links can cross and overlap. Later in this lab, you will also use an **adjacency matrix**, which represents the same relationships differently.

---

# Task 1 — Load Node and Link Data

Create:

```text
lab5/index.html
lab5/lab5.js
```

Load D3 in your HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
<script src="lab5.js"></script>
```

Load both files:

```javascript
Promise.all([
    d3.csv(
        "../data/lab5_small_nodes.csv",
        d => ({
            id: d.id,
            name: d.name,
            group: d.group,
            activity_count: +d.activity_count,
            level: +d.level
        })
    ),
    d3.csv(
        "../data/lab5_small_links.csv",
        d => ({
            source: d.source,
            target: d.target,
            weight: +d.weight,
            type: d.type
        })
    )
])
.then(([nodes, links]) => {

    console.log(nodes);
    console.log(links);

});
```

Why use `Promise.all()`?

```text
nodes.csv
    ↘
     wait until both finish
    ↗
links.csv
```

The visualization needs both tables before it can build the network.

---

# Task 2 — Create the SVG

```javascript
const width = 900;
const height = 600;

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);
```

A force-directed layout needs space to move nodes until the network reaches a stable configuration.

---

# Task 3 — Understand `d3.forceSimulation()`

D3's force simulation assigns and updates positions for nodes.

Create:

```javascript
const simulation = d3.forceSimulation(nodes);
```

At this point, the nodes do not yet know how they should relate to one another. We add forces.

## 3.1 Link Force

The link force pulls connected nodes toward one another.

```javascript
simulation.force(
    "link",
    d3.forceLink(links)
        .id(d => d.id)
        .distance(100)
);
```

The important part is:

```javascript
.id(d => d.id)
```

This tells D3 how to match:

```text
link.source = "n1"
```

with:

```text
node.id = "n1"
```

## 3.2 Charge Force

Nodes repel one another:

```javascript
simulation.force(
    "charge",
    d3.forceManyBody()
        .strength(-250)
);
```

A negative value creates repulsion.

```text
More negative
→ stronger repulsion
→ more space between nodes
```

## 3.3 Center Force

Keep the network near the middle:

```javascript
simulation.force(
    "center",
    d3.forceCenter(
        width / 2,
        height / 2
    )
);
```

## 3.4 Collision Force

Prevent nodes from overlapping too much:

```javascript
simulation.force(
    "collision",
    d3.forceCollide()
        .radius(25)
);
```

A complete simulation may look like:

```javascript
const simulation = d3.forceSimulation(nodes)
    .force(
        "link",
        d3.forceLink(links)
            .id(d => d.id)
            .distance(100)
    )
    .force(
        "charge",
        d3.forceManyBody()
            .strength(-250)
    )
    .force(
        "center",
        d3.forceCenter(
            width / 2,
            height / 2
        )
    )
    .force(
        "collision",
        d3.forceCollide()
            .radius(25)
    );
```

---

# Task 4 — Draw Links

Create links before nodes so that nodes appear above the lines.

```javascript
const link = svg.append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6);
```

At this stage, the links do not yet have positions.

---

# Task 5 — Draw Nodes

```javascript
const node = svg.append("g")
    .attr("class", "nodes")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", 10)
    .attr("fill", "steelblue");
```

Each node is one circle.

```text
One node record
      ↓
One SVG circle
```

---

# Task 6 — Update Positions on Every Simulation Tick

```javascript
simulation.on(
    "tick",
    () => {

        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
    }
);
```

Conceptually:

```text
Simulation calculates positions
        ↓
Update link endpoints
        ↓
Update node positions
        ↓
Repeat
```

---

# Task 7 — Encode Node Size

Map:

```text
activity_count → node size
```

```javascript
const sizeScale = d3.scaleSqrt()
    .domain(
        d3.extent(
            nodes,
            d => d.activity_count
        )
    )
    .range([6, 18]);
```

Apply:

```javascript
node.attr(
    "r",
    d => sizeScale(
        d.activity_count
    )
);
```

---

# Task 8 — Encode Node Color

Map:

```text
group → color
```

```javascript
const groups = Array.from(
    new Set(
        nodes.map(d => d.group)
    )
);

const colorScale = d3.scaleOrdinal()
    .domain(groups)
    .range(d3.schemeTableau10);
```

Apply:

```javascript
node.attr(
    "fill",
    d => colorScale(d.group)
);
```

Now:

```text
size  → activity_count
color → group
```

---

# Task 9 — Encode Link Weight

Map relationship strength to line width.

```javascript
const linkWidthScale = d3.scaleLinear()
    .domain(
        d3.extent(
            links,
            d => d.weight
        )
    )
    .range([1, 6]);
```

Apply:

```javascript
link.attr(
    "stroke-width",
    d => linkWidthScale(d.weight)
);
```

Now:

```text
link weight → line width
```

---

# Task 10 — Encode Link Type

Create a categorical scale:

```javascript
const linkTypes = Array.from(
    new Set(
        links.map(d => d.type)
    )
);

const linkColorScale = d3.scaleOrdinal()
    .domain(linkTypes)
    .range(d3.schemeSet2);
```

Apply:

```javascript
link.attr(
    "stroke",
    d => linkColorScale(d.type)
);
```

Alternatively, link type could be mapped to dash pattern:

```javascript
link.attr(
    "stroke-dasharray",
    d => {
        if (
            d.type === "communication"
        ) {
            return "5,4";
        }

        return null;
    }
);
```

---

# Task 11 — Add Node Labels

```javascript
const label = svg.append("g")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .text(d => d.name)
    .attr("font-size", 12)
    .attr("dx", 12)
    .attr("dy", 4);
```

Update labels during each tick:

```javascript
simulation.on(
    "tick",
    () => {

        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        label
            .attr("x", d => d.x)
            .attr("y", d => d.y);
    }
);
```

---

# Task 12 — Dragging Nodes

```javascript
function dragStarted(
    event,
    d
) {

    if (!event.active) {
        simulation
            .alphaTarget(0.3)
            .restart();
    }

    d.fx = d.x;
    d.fy = d.y;
}
```

During dragging:

```javascript
function dragged(
    event,
    d
) {

    d.fx = event.x;
    d.fy = event.y;
}
```

When dragging ends:

```javascript
function dragEnded(
    event,
    d
) {

    if (!event.active) {
        simulation
            .alphaTarget(0);
    }

    d.fx = null;
    d.fy = null;
}
```

Apply:

```javascript
node.call(
    d3.drag()
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded)
);
```

---

# Task 13 — Highlight Connected Nodes

Create a helper:

```javascript
function isConnected(
    nodeA,
    nodeB
) {

    return links.some(
        link =>
            (
                link.source.id === nodeA.id &&
                link.target.id === nodeB.id
            )
            ||
            (
                link.source.id === nodeB.id &&
                link.target.id === nodeA.id
            )
    );
}
```

Highlight neighbors:

```javascript
node.on(
    "mouseover",
    function(event, d) {

        node.attr(
            "opacity",
            other =>
                (
                    other.id === d.id ||
                    isConnected(d, other)
                )
                ? 1
                : 0.15
        );

        link.attr(
            "opacity",
            l =>
                (
                    l.source.id === d.id ||
                    l.target.id === d.id
                )
                ? 1
                : 0.1
        );

        label.attr(
            "opacity",
            other =>
                (
                    other.id === d.id ||
                    isConnected(d, other)
                )
                ? 1
                : 0.15
        );
    }
);
```

Restore:

```javascript
node.on(
    "mouseout",
    function() {

        node.attr("opacity", 1);
        link.attr("opacity", 0.6);
        label.attr("opacity", 1);
    }
);
```

---

# Task 14 — Add Tooltips

Add to HTML:

```html
<div id="tooltip" class="tooltip"></div>
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
    font-size: 14px;
}
```

JavaScript:

```javascript
const tooltip = d3.select("#tooltip");
```

Add tooltip events:

```javascript
node
    .on(
        "mouseover.tooltip",
        function(event, d) {

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.name}</strong>
                    <br>
                    Group: ${d.group}
                    <br>
                    Activity: ${d.activity_count}
                    <br>
                    Level: ${d.level}
                `);
        }
    )
    .on(
        "mousemove.tooltip",
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
        "mouseout.tooltip",
        function() {

            tooltip.style("opacity", 0);
        }
    );
```

---

# Task 15 — Force-Directed Network Structure

A useful implementation structure is:

```javascript
Promise.all([
    d3.csv("../data/lab5_small_nodes.csv"),
    d3.csv("../data/lab5_small_links.csv")
])
.then(([nodes, links]) => {

    // 1. convert data types
    // 2. create SVG
    // 3. create scales
    // 4. draw links
    // 5. draw nodes
    // 6. draw labels
    // 7. create force simulation
    // 8. update positions on tick
    // 9. add dragging
    // 10. add highlighting
    // 11. add tooltips

});
```

---

# Task 16 — Adjacency Matrix

The same network can also be represented as a matrix.

```text
      A B C D
A     · █ · █
B     █ · █ ·
C     · █ · █
D     █ · █ ·
```

Each row and column represents a node.

A filled cell indicates a link.

## 16.1 Create Matrix Data

```javascript
const matrixData = [];

nodes.forEach(
    rowNode => {

        nodes.forEach(
            colNode => {

                const foundLink =
                    links.find(
                        link =>
                            (
                                link.source.id === rowNode.id &&
                                link.target.id === colNode.id
                            )
                            ||
                            (
                                link.source.id === colNode.id &&
                                link.target.id === rowNode.id
                            )
                    );

                matrixData.push({
                    row: rowNode.id,
                    col: colNode.id,
                    weight:
                        foundLink
                        ? foundLink.weight
                        : 0,
                    type:
                        foundLink
                        ? foundLink.type
                        : null
                });
            }
        );
    }
);
```

## 16.2 Matrix Scales

```javascript
const matrixSize = 500;

const matrixX = d3.scaleBand()
    .domain(nodes.map(d => d.id))
    .range([0, matrixSize])
    .padding(0.02);

const matrixY = d3.scaleBand()
    .domain(nodes.map(d => d.id))
    .range([0, matrixSize])
    .padding(0.02);
```

## 16.3 Draw Cells

```javascript
const matrixSvg = d3.select("#matrix")
    .append("svg")
    .attr("width", 650)
    .attr("height", 650);

const matrixGroup =
    matrixSvg.append("g")
    .attr(
        "transform",
        "translate(100,50)"
    );
```

```javascript
matrixGroup
    .selectAll("rect")
    .data(matrixData)
    .join("rect")
    .attr(
        "x",
        d => matrixX(d.col)
    )
    .attr(
        "y",
        d => matrixY(d.row)
    )
    .attr(
        "width",
        matrixX.bandwidth()
    )
    .attr(
        "height",
        matrixY.bandwidth()
    )
    .attr(
        "fill",
        d =>
            d.weight > 0
            ? "steelblue"
            : "#f3f3f3"
    );
```

## 16.4 Encode Link Weight

```javascript
const opacityScale =
    d3.scaleLinear()
    .domain(
        d3.extent(
            links,
            d => d.weight
        )
    )
    .range([0.25, 1]);
```

Then:

```javascript
.attr(
    "fill-opacity",
    d =>
        d.weight > 0
        ? opacityScale(d.weight)
        : 1
)
```

Now:

```text
cell position → source + target
cell opacity  → link weight
```

You could additionally encode link type with cell color.

---

# Assignment — Encode a 50-Node Network in Two Ways

## Objective

Use the provided network dataset to create:

1. an **interactive node-link visualization**;
2. an **adjacency matrix**.

Then explain your design choices and use the visualizations to answer a set of network-analysis questions.

---

# Assignment Dataset — Urban Transit Network

The assignment uses a **different domain and different variables** from the guided university collaboration example.

You will visualize a synthetic urban transit system containing:

```text
50 stations
50 direct transit connections
```

Use:

```text
data/lab5_assignment_stations.csv
data/lab5_assignment_routes.csv
```

The assignment dataset is intentionally distinct from the tutorial dataset so that you need to decide how to transfer the visualization techniques to a new context.

---

## Dataset Background

Imagine a medium-sized city with five broad districts:

```text
Central
North
South
East
West
```

The transit system contains local stations, transfer stations, and terminal stations. A link between two stations means that passengers can travel directly between those stations without changing to another connection first.

The dataset is **synthetic** and is designed for visualization practice rather than transportation analysis.

The network is treated as **undirected** for this assignment:

```text
Station A — Station B
```

means there is a direct connection between the pair.

---

## Station Table

The node file is:

```text
lab5_assignment_stations.csv
```

It contains **50 stations**.

| Variable | Type of Information | Meaning |
|---|---|---|
| `id` | Identifier | Unique station ID |
| `station_name` | Label | Human-readable station name |
| `district` | Node variable 1 | District in which the station is located |
| `daily_passengers` | Node variable 2 | Approximate average daily passenger volume |
| `station_type` | Node variable 3 | Local, Transfer, or Terminal station |

Example:

```csv
id,station_name,district,daily_passengers,station_type
s1,Station 1,Central,1373,Terminal
s2,Station 2,North,1546,Transfer
```

The three node variables you must encode are therefore:

```text
district
daily_passengers
station_type
```

Possible semantic interpretations:

```text
district
→ geographic/administrative category

daily_passengers
→ how heavily the station is used

station_type
→ functional role in the transit system
```

---

## Route Table

The link file is:

```text
lab5_assignment_routes.csv
```

It contains **50 direct station-to-station connections**.

| Variable | Type of Information | Meaning |
|---|---|---|
| `source` | Endpoint | First station |
| `target` | Endpoint | Second station |
| `travel_time_min` | Link variable 1 | Approximate travel time in minutes |
| `route_type` | Link variable 2 | Metro, Express, or Shuttle |

Example:

```csv
source,target,travel_time_min,route_type
s1,s2,5,Express
s2,s3,8,Shuttle
```

The two link variables you must encode are:

```text
travel_time_min
route_type
```

Possible semantic interpretations:

```text
travel_time_min
→ how long the direct connection takes

route_type
→ what type of transit service provides the connection
```

---

# Assignment Part A — Node-Link Visualization

Because the assignment data has different semantics from the tutorial, **do not simply copy the tutorial encodings without thinking about them**.

For example, ask yourself:

```text
Should passenger volume be represented by node size?
Should station type be represented by shape, border, or another channel?
Should longer travel time appear visually stronger or weaker?
How should route type be distinguished?
```

There is no single required mapping, but all required variables must be represented clearly.


Create a force-directed network using:

```javascript
d3.forceSimulation()
```

Your node-link visualization must encode all three node variables:

```text
group
activity_count
role
```

and both link variables:

```text
weight
type
```

## Node-Link Requirements

Include:

- D3 force simulation;
- encoding of all three node variables;
- encoding of both link variables;
- node dragging;
- node/link highlighting;
- tooltips;
- a legend or clear explanation of encodings.

The viewer should be able to identify individual nodes.

---

# Assignment Part B — Adjacency Matrix

Using the **same network**, create an adjacency matrix.

Your goal is to encode **as much information as reasonably possible**.

Remember that matrix rows and columns both represent **stations**, while each cell represents the relationship between a pair of stations. Think carefully about whether row/column ordering can reveal district or station-type structure.

At minimum, show:

```text
which pairs of nodes are connected
```

You should also attempt to include node and link attributes.

You do not need to encode all five attributes if doing so makes the matrix unreadable.

---

# Assignment Part C — Design Description and Network Questions

Instead of comparing the node-link diagram and adjacency matrix, explain **how you designed each visualization and what network questions your design helps answer**.

Write approximately **150–300 words in total**.

---

## C1. Describe Your Node-Link Design

Briefly explain how you encoded the station and route variables.

For example:

```text
district          → node color
daily_passengers  → node size
station_type      → node shape

travel_time_min   → link width
route_type        → link color
```

Do not simply list the mappings. Explain why your choices make sense for the transit-network context.

Also mention how interaction helps the reader, for example:

```text
dragging
hover highlighting
tooltips
```

---

## C2. Describe Your Matrix Design

Explain how your adjacency matrix represents the same network.

For example:

```text
row / column      → station
filled cell       → direct connection
cell opacity      → travel time
cell color        → route type
label color       → district
ordering          → district or station type
```

Explain what information you decided to preserve and how row/column ordering helps reveal network structure.

---

## C3. Answer Network Questions Using Your Visualizations

Consider the following questions:

```text
1. Which stations appear central in the network?

2. Which districts are strongly connected to one another?

3. Where are transfer or terminal stations located in the topology?

4. Which stations have high passenger volume?

5. Where are the longest direct travel-time connections?

6. Are particular route types concentrated in particular parts of the network?
```

For **each question**, do the following:

1. State whether the question can be answered well, partially, or not easily using your designed visualization.
2. State **which visualization** you use to answer it:
   - node-link;
   - adjacency matrix;
   - both.
3. Explain **which visual encoding or interaction** supports the answer.
4. Give the **actual answer or observation** you obtain from your visualization.


### Important

Your answer should be based on **your visualization**, not only on reading the CSV file.

For example, instead of writing:

```text
Station 12 has 8,900 passengers.
```

explain what the visualization reveals:

```text
Station 12 is among the highest-volume stations.
This is visible because its node is one of the largest
in the node-link diagram.
```

If your visualization makes a question difficult to answer, it is acceptable to say so.

For example:

```text
It is difficult to identify strongly connected districts
because I did not group or order stations by district in
my matrix. The district color shows membership, but the
connection pattern is difficult to compare.
```

Recognizing what your design **does and does not support** is part of the assignment.

---

# Suggested Lab 5 Page Structure

```text
Lab 5: Interactive Network Visualization

1. Dataset Description

2. Node-Link Visualization
   [interactive force-directed graph]

3. Node-Link Design Description

4. Adjacency Matrix
   [matrix visualization]

5. Matrix Design Description

6. Network Questions and Findings
   [question-by-question table or paragraphs]
```

---

# Assignment Requirements

1. Use the provided 50-node/50-link dataset.
2. Load the node and link files externally.
3. Use D3 data binding.
4. Create a force-directed node-link diagram.
5. Encode all three node variables.
6. Encode both link variables.
7. Include dragging.
8. Include highlighting.
9. Include tooltips.
10. Include legends or encoding explanations.
11. Create an adjacency matrix from the same data.
12. Encode link existence in the matrix.
13. Attempt to encode additional node/link attributes in the matrix.
14. Describe and justify the design of both visualizations.
15. Address all six provided network questions.
16. For each question, identify the most useful view and report an observation/answer based on the visualization.
---

# What to Submit

Submit **one GitHub Pages link** that directly opens your Lab 5 assignment.

Example:

```text
https://yourusername.github.io/stats401-labs/lab5/
```

The page should contain:

```text
Node-link visualization
+
Node-link design description
+
Adjacency matrix
+
Matrix design description
+
Answers/observations for the six network questions
```

---

# Submission Checklist
- [ ] My node-link view uses `d3.forceSimulation()`.
- [ ] My node-link view encodes `district`.
- [ ] My node-link view encodes `daily_passengers`.
- [ ] My node-link view encodes `station_type`.
- [ ] My node-link view encodes link `travel_time_min`.
- [ ] My node-link view encodes link `route_type`.
- [ ] Nodes can be dragged.
- [ ] Hovering/highlighting helps inspect network structure.
- [ ] Tooltips provide node information.
- [ ] Legends or clear encoding explanations are included.
- [ ] I created an adjacency matrix from the same data.
- [ ] I describe and justify the design of my node-link visualization and adjacency matrix.
- [ ] I address all six provided network questions.
- [ ] For each question, I identify which visualization is most useful.
- [ ] For each question, I explain which encoding/interaction supports the analysis.
- [ ] For each question, I provide an answer or observation based on my visualization.
---
