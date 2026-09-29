# Lab 9 — Geospatial Visualization with D3

**STATS 401: Data Acquisition and Visualization**

## Learning Objectives

By the end of this lab, you should be able to:

1. Read geographic boundaries stored as **GeoJSON**.
2. Understand longitude and latitude coordinates.
3. Use D3 geographic projections.
4. Use `d3.geoPath()` to draw GeoJSON features.
5. Join geographic boundaries with statistical data using geographic identifiers.
6. Create an interactive **choropleth map**.
7. Add quantitative color encoding, legends, highlighting, and tooltips.
8. Understand how a **cartogram** transforms geographic area.
9. Compare choropleth and cartogram representations of the same data.

---

# 1. Geographic Data and GeoJSON

Geospatial visualization combines:

```text
Geographic Data
+
Statistical Data
+
Visual Encoding
```

For example:

```text
Country boundaries + GDP + Color
→ Choropleth Map

Country boundaries + GDP + Area Distortion
→ Cartogram
```

GeoJSON is a common format for geographic data.

A feature contains:

```json
{
  "type": "Feature",
  "properties": {
    "name": "Example",
    "iso3": "XXX"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": []
  }
}
```

Important parts:

```text
geometry
→ geographic shape

properties
→ name / identifier / metadata
```

Common geometry types include:

```text
Point
LineString
Polygon
MultiPolygon
```

---

# 2. Geographic Coordinates

GeoJSON uses:

```text
[longitude, latitude]
```

For example:

```javascript
const location = [
    121.47,
    31.23
];
```

Longitude/latitude must be transformed into screen coordinates before being drawn.

```text
Longitude + Latitude
        ↓
Projection
        ↓
x + y Screen Coordinates
```

---

# 3. Geographic Projections

D3 provides geographic projections such as:

```javascript
d3.geoMercator()
d3.geoNaturalEarth1()
d3.geoEqualEarth()
d3.geoOrthographic()
```

For a world map:

```javascript
const projection =
    d3.geoNaturalEarth1();
```

Fit the geographic data to the SVG:

```javascript
const width = 1000;
const height = 600;

projection.fitSize(
    [width, height],
    geoData
);
```

Different projections introduce different distortions. The appropriate projection depends on the visualization task.

---

# 4. Drawing GeoJSON with `d3.geoPath()`

Create a geographic path generator:

```javascript
const path =
    d3.geoPath()
    .projection(projection);
```

Draw:

```javascript
svg.selectAll(".country")
    .data(geoData.features)
    .join("path")
    .attr("class", "country")
    .attr("d", path);
```

Pipeline:

```text
GeoJSON
   ↓
Projection
   ↓
d3.geoPath()
   ↓
SVG Path
```

---

# 5. Joining Geographic and Statistical Data

Suppose the geographic file contains:

```text
feature.properties.iso3
```

and the statistical data contain:

```csv
iso3,value
USA,100
CHN,80
JPN,50
```

Load both:

```javascript
Promise.all([
    d3.json("../data/world.geojson"),

    d3.csv(
        "../data/country_data.csv",
        d => ({
            iso3: d.iso3,
            value: +d.value
        })
    )
])
.then(([geoData, stats]) => {

    const valueById =
        new Map(
            stats.map(
                d => [
                    d.iso3,
                    d.value
                ]
            )
        );

    geoData.features.forEach(
        feature => {

            feature.properties.value =
                valueById.get(
                    feature.properties.iso3
                );
        }
    );

});
```

The key idea is:

```text
GeoJSON identifier
        ↕
Statistical-data identifier
```

---

# 6. Choropleth Map

A choropleth represents a value through the color of geographic regions.

```text
Geographic Region
       ↓
Color
       ↓
Quantitative Value
```

Create a color scale:

```javascript
const colorScale =
    d3.scaleSequential(
        d3.interpolateBlues
    )
    .domain([
        0,
        d3.max(
            geoData.features,
            d =>
                d.properties.value || 0
        )
    ]);
```

Draw:

```javascript
const countries =
    svg.selectAll(".country")
    .data(geoData.features)
    .join("path")
    .attr("d", path)
    .attr(
        "fill",
        d => {

            const value =
                d.properties.value;

            return value == null
                ? "#eee"
                : colorScale(value);
        }
    )
    .attr("stroke", "white");
```

Encoding:

```text
Position → geographic location
Shape    → country boundary
Color    → data value
```

---

# 7. Tooltips

Add:

```html
<div id="tooltip" class="tooltip"></div>
```

```javascript
const tooltip =
    d3.select("#tooltip");

countries
    .on(
        "mouseover",
        function(event, d) {

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>
                        ${d.properties.name}
                    </strong>
                    <br>
                    Value:
                    ${d.properties.value}
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

Also include a quantitative legend so users can interpret the color scale.

---

# 8. Highlighting and Zoom

Highlight the selected country:

```javascript
countries
    .on(
        "mouseover.highlight",
        function() {

            d3.select(this)
                .attr("stroke", "black")
                .attr("stroke-width", 2);
        }
    )
    .on(
        "mouseout.highlight",
        function() {

            d3.select(this)
                .attr("stroke", "white")
                .attr("stroke-width", 1);
        }
    );
```

Add zoom/pan:

```javascript
const zoom =
    d3.zoom()
    .scaleExtent([1, 8])
    .on(
        "zoom",
        function(event) {

            mapGroup.attr(
                "transform",
                event.transform
            );
        }
    );

svg.call(zoom);
```

---

# 9. Cartograms

A conventional geographic map represents:

```text
Country Area
→ Geographic Area
```

A cartogram intentionally changes geographic area:

```text
Country Area
→ Data Value
```

For example:

```text
GDP Cartogram

Large GDP
→ country becomes larger

Small GDP
→ country becomes smaller
```

Conceptually:

```text
GeoJSON
   +
Statistical Value
   ↓
Cartogram Algorithm
   ↓
Distorted Geometry
   ↓
SVG
```

A cartogram gains a strong quantitative area encoding but sacrifices geographic shape and area accuracy.

You may use a D3-compatible cartogram implementation provided by the instructor or another documented JavaScript cartogram library.

E.g.,
https://github.com/vasturiano/cartogram-chart 

https://github.com/shawnbot/topogram

---

# 10. Choropleth vs. Cartogram

For the same GDP variable:

## Choropleth

```text
Position → geographic location
Shape    → original geography
Color    → GDP
```

## Cartogram

```text
Position → approximate geography
Shape    → distorted geography
Area     → GDP
```

Therefore:

```text
Choropleth
→ emphasizes geographic pattern

Cartogram
→ emphasizes quantitative magnitude
```

Neither representation is universally better. The appropriate choice depends on the task.

---

# 11. Linked Highlighting

Cartogram distortion can make countries difficult to recognize.

A useful interaction is:

```text
Hover / Click Country
        ↓
Highlight Country in Choropleth
        +
Highlight Same Country in Cartogram
```

This helps users maintain correspondence between the two representations.

---

# Assignment — 2025 GDP: Choropleth vs. Cartogram

## Objective

Create two coordinated geographic visualizations of **2025 nominal GDP**:

1. a **choropleth map**;
2. a **cartogram**.

Use the same GDP data in both visualizations and compare what each representation emphasizes.

---

# Assignment Dataset

Use:

```text
data/lab9_gdp_2025_top50.csv
```

The provided file contains the **50 largest economies by nominal GDP in 2025**.

Variables:

| Variable | Meaning |
|---|---|
| `iso3` | ISO-3 geographic identifier |
| `country` | Country/economy name |
| `gdp_2025_billion_usd` | 2025 nominal GDP, current prices, billions of U.S. dollars |
| `rank` | GDP rank among the included economies |

The data are based on the **IMF World Economic Outlook, October 2025** nominal-GDP series. The IMF notes that WEO observations may include IMF staff estimates where complete official data are unavailable and can later be revised.

Countries outside the provided top-50 dataset should be treated as **no data**, not as zero GDP.

---

# Part A — Join GDP with GeoJSON

Load:

```text
World country GeoJSON
+
lab9_gdp_2025_top50.csv
```

Join them using:

```text
ISO-3 identifier
```

Check that country identifiers match correctly.

Use a distinct neutral appearance for countries without GDP values in the provided dataset.

---

# Part B — Choropleth

Create a choropleth:

```text
Country Shape
→ actual geographic boundary

Color
→ 2025 GDP
```

Include:

- title;
- quantitative color legend;
- tooltip showing country and GDP;
- highlighting;
- zoom/pan.

Because GDP values are highly skewed, consider whether a linear, logarithmic, or transformed color scale produces the clearest map. Explain your choice.

---

# Part C — Cartogram

Create a cartogram using the same data:

```text
Country Area
→ 2025 GDP
```

Countries with larger GDP should occupy more visual area.

Include:

- title;
- tooltip;
- country highlighting;
- clear explanation that **area represents GDP**.

---

# Part D — Coordinate the Views

Implement linked highlighting:

```text
Select Country in One Map
        ↓
Highlight Same Country
in Both Maps
```

This is particularly useful when cartogram distortion makes familiar country shapes difficult to recognize.

---

# Part E — Analyze and Compare

Write approximately **150–250 words** addressing:

1. Which countries are most visually prominent in each map?
2. Which countries become much larger or smaller in the cartogram?
3. What geographic information does the choropleth preserve?
4. What geographic information does the cartogram distort?
5. What types of questions or tasks can the choropleth best support?
6. What types of questions or tasks can the cartogram best support?
7. How does changing from color encoding to area encoding change your perception of global economic size?

Do not simply state that one map is better. Discuss:

```text
Task
+
Visual Encoding
+
Geographic Information
+
Trade-off
```

---

# Submission Requirements

Publish the assignment as **Lab 9** on your existing GitHub Pages website and submit the direct Lab 9 URL.

Suggested structure:

```text
Lab 9: Geospatial Visualization

1. Dataset Description

2. 2025 GDP Choropleth
   [interactive map]

3. 2025 GDP Cartogram
   [interactive map]

4. Design and Comparison
   [150–250 words]
```

---

# Submission Checklist

- [ ] I use the provided 2025 GDP dataset.
- [ ] I join GDP and GeoJSON using geographic identifiers.
- [ ] I use a D3 geographic projection and `d3.geoPath()`.
- [ ] I create a choropleth with GDP encoded by color.
- [ ] I include a quantitative legend and tooltips.
- [ ] I create a cartogram with GDP encoded by area.
- [ ] I include linked country highlighting.
- [ ] Countries without provided GDP values are shown as missing data, not zero.
- [ ] I include a 150–250 word design comparison.
- [ ] I explain what tasks each map best supports.
---
