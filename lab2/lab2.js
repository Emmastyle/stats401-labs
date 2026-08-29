const tooltip = d3.select("#tooltip");

async function drawStudentsChart() {
    const width = 900;
    const height = 500;
    const margin = { top: 35, right: 190, bottom: 70, left: 70 };

    const data = await d3.csv("../data/students_multivariate.csv", d => ({
        name: d.name,
        study_hours: +d.study_hours,
        score: +d.score,
        major: d.major,
        year: d.year
    }));

    const svg = d3.select("#students-chart")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`);

    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.study_hours))
        .nice()
        .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.score))
        .nice()
        .range([height - margin.bottom, margin.top]);

    const majors = Array.from(new Set(data.map(d => d.major)));

    const colorScale = d3.scaleOrdinal()
        .domain(majors)
        .range(d3.schemeTableau10);

    const sizeScale = d3.scaleOrdinal()
        .domain(["Freshman", "Sophomore", "Junior", "Senior"])
        .range([5, 7, 9, 11]);

    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(xScale));

    svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(yScale));

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

    svg.selectAll(".student-point")
        .data(data)
        .join("circle")
        .attr("class", "student-point")
        .attr("cx", d => xScale(d.study_hours))
        .attr("cy", d => yScale(d.score))
        .attr("r", d => sizeScale(d.year))
        .attr("fill", d => colorScale(d.major))
        .attr("opacity", 0.85)
        .on("mouseover", function (event, d) {
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
        .on("mousemove", function (event) {
            tooltip
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", function () {
            tooltip.style("opacity", 0);
        });

    const legend = svg.append("g")
        .attr("transform", `translate(${width - margin.right + 25}, 60)`);

    legend.append("text")
        .attr("x", 0)
        .attr("y", -12)
        .text("Major");

    legend.selectAll(".legend-item")
        .data(majors)
        .join("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 24})`)
        .call(g => {
            g.append("circle")
                .attr("r", 6)
                .attr("cx", 6)
                .attr("fill", d => colorScale(d));
            g.append("text")
                .attr("x", 18)
                .attr("y", 4)
                .text(d => d);
        });
}

function citySort(a, b) {
    const regionOrder = ["North", "South", "East", "West"];
    const regionA = regionOrder.indexOf(a.region);
    const regionB = regionOrder.indexOf(b.region);
    if (regionA !== regionB) {
        return regionA - regionB;
    }
    return d3.descending(a.population, b.population);
}

async function drawCitiesChart() {
    const width = 1040;
    const height = 620;
    const margin = { top: 28, right: 250, bottom: 70, left: 130 };
    const regionOrder = ["North", "South", "East", "West"];
    const levelOrder = ["Low", "Medium", "High"];

    const regionColors = d3.scaleOrdinal()
        .domain(regionOrder)
        .range(["#3b6755", "#e8582a", "#577590", "#7a5c99"]);

    const levelStroke = d3.scaleOrdinal()
        .domain(levelOrder)
        .range([1.4, 1.8, 3.4]);

    const levelDash = d3.scaleOrdinal()
        .domain(levelOrder)
        .range(["6,4", "0", "0"]);

    const levelOpacity = d3.scaleOrdinal()
        .domain(levelOrder)
        .range([0.85, 0.9, 0.95]);

    const data = await d3.csv("../data/cities_multivariate.csv", d => ({
        city: d.city,
        population: +d.population,
        temp_c: +d.temp_c,
        development_level: d.development_level,
        region: d.region
    }));

    const sorted = data.slice().sort(citySort);
    const chart = d3.select("#chart");

    const svg = chart.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("aria-labelledby", "svg-title svg-desc");

    svg.append("title")
        .attr("id", "svg-title")
        .text("Multivariate City Profiles");

    svg.append("desc")
        .attr("id", "svg-desc")
        .text("Population on x-axis, region in color, development level in opacity and stroke, and temperature in bubble size.");

    const x = d3.scaleLinear()
        .domain([0, d3.max(sorted, d => d.population)])
        .nice()
        .range([margin.left, width - margin.right]);

    const y = d3.scaleBand()
        .domain(sorted.map(d => d.city))
        .range([margin.top, height - margin.bottom])
        .padding(0.34);

    const [tMin, tMax] = d3.extent(sorted, d => d.temp_c);
    const tempCut1 = tMin + (tMax - tMin) / 3;
    const tempCut2 = tMin + (tMax - tMin) * 2 / 3;

    function tempBand(temp) {
        if (temp < tempCut1) {
            return "Cool";
        }
        if (temp < tempCut2) {
            return "Mild";
        }
        return "Warm";
    }

    const tempShape = d3.scaleOrdinal()
        .domain(["Cool", "Mild", "Warm"])
        .range([d3.symbolCircle, d3.symbolSquare, d3.symbolTriangle]);

    const tempShapeSize = d3.scaleLinear()
        .domain([tMin, tMax])
        .range([120, 220]);

    const regions = d3.groups(sorted, d => d.region);
    const regionBand = svg.append("g");
    regions.forEach(group => {
        const region = group[0];
        const cities = group[1];
        const first = y(cities[0].city);
        const last = y(cities[cities.length - 1].city);
        const bandTop = first - y.bandwidth() * 0.22;
        const bandHeight = (last - first) + y.bandwidth() * 1.44;

        regionBand.append("rect")
            .attr("x", margin.left)
            .attr("y", bandTop)
            .attr("width", width - margin.left - margin.right)
            .attr("height", bandHeight)
            .attr("fill", regionColors(region))
            .attr("opacity", 0.06);
    });

    const xGrid = d3.axisBottom(x)
        .ticks(6)
        .tickSize(-(height - margin.top - margin.bottom))
        .tickFormat("");

    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(xGrid)
        .selectAll("line")
        .attr("stroke", "rgba(23, 33, 29, 0.14)");

    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(6));

    svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(y));

    svg.append("text")
        .attr("x", (margin.left + width - margin.right) / 2)
        .attr("y", height - 20)
        .attr("text-anchor", "middle")
        .style("font-size", "13px")
        .text("Population (millions)");

    const rows = svg.selectAll(".city-row")
        .data(sorted)
        .join("g")
        .attr("class", "city-row")
        .on("mouseover", function (event, d) {
            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.city}</strong><br>
                    Population: ${d.population}M<br>
                    Temperature: ${d.temp_c}&deg;C<br>
                    Development: ${d.development_level}<br>
                    Region: ${d.region}
                `);
        })
        .on("mousemove", function (event) {
            tooltip
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", function () {
            tooltip.style("opacity", 0);
        });

    rows.append("line")
        .attr("x1", x(0))
        .attr("x2", d => x(d.population))
        .attr("y1", d => y(d.city) + y.bandwidth() / 2)
        .attr("y2", d => y(d.city) + y.bandwidth() / 2)
        .attr("stroke", d => regionColors(d.region))
        .attr("stroke-width", d => levelStroke(d.development_level))
        .attr("stroke-dasharray", d => levelDash(d.development_level))
        .attr("opacity", d => levelOpacity(d.development_level))
        .attr("stroke-linecap", "round");

    rows.append("path")
        .attr("transform", d => `translate(${x(d.population)}, ${y(d.city) + y.bandwidth() / 2})`)
        .attr("d", d => d3.symbol()
            .type(tempShape(tempBand(d.temp_c)))
            .size(tempShapeSize(d.temp_c))())
        .attr("fill", d => regionColors(d.region))
        .attr("stroke", "#17211d")
        .attr("stroke-width", d => levelStroke(d.development_level))
        .attr("stroke-dasharray", d => levelDash(d.development_level))
        .attr("opacity", d => levelOpacity(d.development_level));

    const legendX = width - margin.right + 20;

    svg.append("text")
        .attr("x", legendX)
        .attr("y", margin.top + 6)
        .style("font-size", "13px")
        .style("font-weight", "600")
        .text("Legend");

    const regionLegend = svg.append("g")
        .attr("transform", `translate(${legendX}, ${margin.top + 34})`);
    regionLegend.append("text")
        .style("font-size", "12px")
        .text("Color = Region");
    const regionItems = regionLegend.selectAll(".region-item")
        .data(regionOrder)
        .join("g")
        .attr("transform", (d, i) => `translate(0, ${20 + i * 22})`);
    regionItems.append("circle")
        .attr("r", 6)
        .attr("cx", 6)
        .attr("fill", d => regionColors(d));
    regionItems.append("text")
        .attr("x", 18)
        .attr("y", 4)
        .style("font-size", "12px")
        .text(d => d);

    const levelLegend = svg.append("g")
        .attr("transform", `translate(${legendX}, ${margin.top + 156})`);
    levelLegend.append("text")
        .style("font-size", "12px")
        .text("Line style = Development");
    const levelItems = levelLegend.selectAll(".level-item")
        .data(levelOrder)
        .join("g")
        .attr("transform", (d, i) => `translate(0, ${20 + i * 24})`);
    levelItems.append("line")
        .attr("x1", 0)
        .attr("x2", 18)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", "#17211d")
        .attr("stroke-width", d => levelStroke(d))
        .attr("stroke-dasharray", d => levelDash(d))
        .attr("opacity", d => levelOpacity(d));
    levelItems.append("text")
        .attr("x", 24)
        .attr("y", 4)
        .style("font-size", "12px")
        .text(d => d);

    const tempLegend = svg.append("g")
        .attr("transform", `translate(${legendX}, ${margin.top + 280})`);
    tempLegend.append("text")
        .style("font-size", "12px")
        .text("Shape = Temperature");
    const tMid = (tMin + tMax) / 2;
    const tempItems = tempLegend.selectAll(".temp-item")
        .data([
            { label: `Cool (< ${tempCut1.toFixed(1)}°C)`, key: "Cool", value: tMin },
            { label: `Mild (${tempCut1.toFixed(1)}–${tempCut2.toFixed(1)}°C)`, key: "Mild", value: tMid },
            { label: `Warm (>= ${tempCut2.toFixed(1)}°C)`, key: "Warm", value: tMax }
        ])
        .join("g")
        .attr("transform", (d, i) => `translate(0, ${24 + i * 34})`);
    tempItems.append("path")
        .attr("transform", "translate(10, 0)")
        .attr("d", d => d3.symbol()
            .type(tempShape(d.key))
            .size(tempShapeSize(d.value))())
        .attr("fill", "#d9d9d9")
        .attr("stroke", "#17211d");
    tempItems.append("text")
        .attr("x", 30)
        .attr("y", 4)
        .style("font-size", "12px")
        .text(d => d.label);
}

Promise.all([drawStudentsChart(), drawCitiesChart()]).catch(error => {
    d3.select("#chart")
        .append("p")
        .attr("class", "chart-error")
        .text(`The chart data could not be loaded: ${error.message}`);
});
