const tooltip = d3.select("#tooltip");

const districtColors = {
    Central: "#e8582a",
    North: "#3b6755",
    South: "#2a6f8f",
    East: "#c49a3c",
    West: "#7a4e7d"
};

const routeColors = {
    Metro: "#17211d",
    Express: "#e8582a",
    Shuttle: "#8a8174"
};

const typeSymbols = {
    Local: d3.symbolCircle,
    Transfer: d3.symbolDiamond,
    Terminal: d3.symbolSquare
};

const districtOrder = ["Central", "North", "South", "East", "West"];
const typeOrder = ["Transfer", "Local", "Terminal"];
const typeAbbrev = {
    Local: "L",
    Transfer: "Tf",
    Terminal: "Te"
};

function endpointId(end) {
    return typeof end === "object" ? end.id : end;
}

function isConnected(links, nodeA, nodeB) {
    return links.some(link => {
        const source = endpointId(link.source);
        const target = endpointId(link.target);
        return (
            (source === nodeA.id && target === nodeB.id) ||
            (source === nodeB.id && target === nodeA.id)
        );
    });
}

function findLink(links, idA, idB) {
    return links.find(link => {
        const source = endpointId(link.source);
        const target = endpointId(link.target);
        return (
            (source === idA && target === idB) ||
            (source === idB && target === idA)
        );
    });
}

function dragStarted(event, d, simulation) {
    if (!event.active) {
        simulation.alphaTarget(0.3).restart();
    }
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragEnded(event, d, simulation) {
    if (!event.active) {
        simulation.alphaTarget(0);
    }
    d.fx = null;
    d.fy = null;
}

function showTooltip(event, html) {
    tooltip
        .style("opacity", 1)
        .html(html)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`);
}

function moveTooltip(event) {
    tooltip
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`);
}

function hideTooltip() {
    tooltip.style("opacity", 0);
}

function drawTutorial(nodes, links) {
    const width = 900;
    const height = 600;

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "img")
        .attr("aria-labelledby", "tutorial-svg-title");

    svg.append("title")
        .attr("id", "tutorial-svg-title")
        .text("University collaboration force-directed network");

    const groups = Array.from(new Set(nodes.map(d => d.group)));
    const linkTypes = Array.from(new Set(links.map(d => d.type)));

    const sizeScale = d3.scaleSqrt()
        .domain(d3.extent(nodes, d => d.activity_count))
        .range([6, 18]);

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(d3.schemeTableau10);

    const linkWidthScale = d3.scaleLinear()
        .domain(d3.extent(links, d => d.weight))
        .range([1, 6]);

    const linkColorScale = d3.scaleOrdinal()
        .domain(linkTypes)
        .range(d3.schemeSet2);

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
            d3.forceCenter(width / 2, height / 2)
        )
        .force(
            "collision",
            d3.forceCollide()
                .radius(25)
        );

    const link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", d => linkColorScale(d.type))
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", d => linkWidthScale(d.weight))
        .attr("stroke-dasharray", d => (
            d.type === "communication" ? "5,4" : null
        ));

    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("class", "network-node")
        .attr("r", d => sizeScale(d.activity_count))
        .attr("fill", d => colorScale(d.group))
        .attr("stroke", "#f4f1e9")
        .attr("stroke-width", 1.2);

    const label = svg.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .text(d => d.name)
        .attr("font-size", 12)
        .attr("dx", 12)
        .attr("dy", 4)
        .attr("fill", "#17211d")
        .style("pointer-events", "none");

    simulation.on("tick", () => {
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
    });

    node.call(
        d3.drag()
            .on("start", (event, d) => dragStarted(event, d, simulation))
            .on("drag", dragged)
            .on("end", (event, d) => dragEnded(event, d, simulation))
    );

    node.on("mouseover", function (event, d) {
        node.attr("opacity", other => (
            other.id === d.id || isConnected(links, d, other) ? 1 : 0.15
        ));
        link.attr("opacity", l => (
            endpointId(l.source) === d.id || endpointId(l.target) === d.id ? 1 : 0.1
        ));
        label.attr("opacity", other => (
            other.id === d.id || isConnected(links, d, other) ? 1 : 0.15
        ));
    });

    node.on("mouseout", function () {
        node.attr("opacity", 1);
        link.attr("opacity", 0.6);
        label.attr("opacity", 1);
    });

    node
        .on("mouseover.tooltip", function (event, d) {
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
        })
        .on("mousemove.tooltip", function (event) {
            tooltip
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout.tooltip", function () {
            tooltip.style("opacity", 0);
        });

    drawTutorialMatrix(nodes, links);
}

function drawTutorialMatrix(nodes, links) {
    const matrixData = [];

    nodes.forEach(rowNode => {
        nodes.forEach(colNode => {
            const foundLink = findLink(links, rowNode.id, colNode.id);
            matrixData.push({
                row: rowNode.id,
                col: colNode.id,
                name: rowNode.name,
                otherName: colNode.name,
                weight: foundLink ? foundLink.weight : 0,
                type: foundLink ? foundLink.type : null
            });
        });
    });

    const matrixSize = 500;
    const matrixX = d3.scaleBand()
        .domain(nodes.map(d => d.id))
        .range([0, matrixSize])
        .padding(0.02);
    const matrixY = d3.scaleBand()
        .domain(nodes.map(d => d.id))
        .range([0, matrixSize])
        .padding(0.02);

    const opacityScale = d3.scaleLinear()
        .domain(d3.extent(links, d => d.weight))
        .range([0.25, 1]);

    const matrixSvg = d3.select("#tutorial-matrix")
        .append("svg")
        .attr("width", 650)
        .attr("height", 650)
        .attr("viewBox", "0 0 650 650");

    const matrixGroup = matrixSvg.append("g")
        .attr("transform", "translate(100,50)");

    matrixGroup
        .selectAll("rect")
        .data(matrixData)
        .join("rect")
        .attr("x", d => matrixX(d.col))
        .attr("y", d => matrixY(d.row))
        .attr("width", matrixX.bandwidth())
        .attr("height", matrixY.bandwidth())
        .attr("fill", d => (d.weight > 0 ? "steelblue" : "#f3f3f3"))
        .attr("fill-opacity", d => (d.weight > 0 ? opacityScale(d.weight) : 1))
        .on("mouseover", function (event, d) {
            if (d.weight <= 0) {
                return;
            }
            showTooltip(
                event,
                `<strong>${d.name} — ${d.otherName}</strong><br>${d.type}<br>Weight: ${d.weight}`
            );
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);

    matrixGroup
        .selectAll(".row-label")
        .data(nodes)
        .join("text")
        .attr("class", "row-label")
        .attr("x", -8)
        .attr("y", d => matrixY(d.id) + matrixY.bandwidth() / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("font-size", 12)
        .text(d => d.name);

    matrixGroup
        .selectAll(".col-label")
        .data(nodes)
        .join("text")
        .attr("class", "col-label")
        .attr("x", d => matrixX(d.id) + matrixX.bandwidth() / 2)
        .attr("y", -8)
        .attr("text-anchor", "start")
        .attr("font-size", 12)
        .attr("transform", d => {
            const x = matrixX(d.id) + matrixX.bandwidth() / 2;
            return `rotate(-90, ${x}, -8)`;
        })
        .text(d => d.name);
}

function symbolPath(type, radius) {
    return d3.symbol()
        .type(typeSymbols[type])
        .size(Math.PI * radius * radius)();
}

function drawAssignment(nodes, links) {
    const width = 1100;
    const height = 740;
    const plotWidth = 820;

    d3.select("#network-status")
        .text(`${nodes.length} stations · ${links.length} routes`);

    const sizeScale = d3.scaleSqrt()
        .domain(d3.extent(nodes, d => d.daily_passengers))
        .range([6, 18]);

    const linkWidthScale = d3.scaleLinear()
        .domain(d3.extent(links, d => d.travel_time_min))
        .range([1, 6]);

    const svg = d3.select("#assignment-chart")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "img")
        .attr("aria-labelledby", "assignment-svg-title");

    svg.append("title")
        .attr("id", "assignment-svg-title")
        .text("Urban transit force-directed network");

    const cx = plotWidth / 2;
    const cy = height / 2;
    const spread = 200;
    const districtCenters = {
        Central: [cx, cy],
        North: [cx, cy - spread],
        South: [cx, cy + spread],
        East: [cx + spread, cy],
        West: [cx - spread, cy]
    };

    const simulation = d3.forceSimulation(nodes)
        .force(
            "link",
            d3.forceLink(links)
                .id(d => d.id)
                .distance(d => 48 + d.travel_time_min)
        )
        .force(
            "charge",
            d3.forceManyBody()
                .strength(-220)
        )
        .force(
            "center",
            d3.forceCenter(cx, cy)
        )
        .force(
            "collision",
            d3.forceCollide()
                .radius(d => sizeScale(d.daily_passengers) + 8)
        )
        .force(
            "x",
            d3.forceX(d => districtCenters[d.district][0]).strength(0.12)
        )
        .force(
            "y",
            d3.forceY(d => districtCenters[d.district][1]).strength(0.12)
        );

    const link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", d => routeColors[d.route_type])
        .attr("stroke-opacity", 0.7)
        .attr("stroke-width", d => linkWidthScale(d.travel_time_min))
        .attr("stroke-dasharray", d => (
            d.route_type === "Shuttle" ? "5,4" : null
        ));

    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("path")
        .data(nodes)
        .join("path")
        .attr("class", "network-node")
        .attr("d", d => symbolPath(d.station_type, sizeScale(d.daily_passengers)))
        .attr("fill", d => districtColors[d.district])
        .attr("stroke", "#f4f1e9")
        .attr("stroke-width", 1.2);

    const label = svg.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .text(d => d.id.replace("s", ""))
        .attr("font-size", 10)
        .attr("dx", 10)
        .attr("dy", 4)
        .attr("fill", "#17211d")
        .style("pointer-events", "none");

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x},${d.y})`);

        label
            .attr("x", d => d.x)
            .attr("y", d => d.y);
    });

    node.call(
        d3.drag()
            .on("start", (event, d) => dragStarted(event, d, simulation))
            .on("drag", dragged)
            .on("end", (event, d) => dragEnded(event, d, simulation))
    );

    node.on("mouseover", function (event, d) {
        node.attr("opacity", other => (
            other.id === d.id || isConnected(links, d, other) ? 1 : 0.15
        ));
        link.attr("opacity", l => (
            endpointId(l.source) === d.id || endpointId(l.target) === d.id ? 1 : 0.1
        ));
        label.attr("opacity", other => (
            other.id === d.id || isConnected(links, d, other) ? 1 : 0.15
        ));
    });

    node.on("mouseout", function () {
        node.attr("opacity", 1);
        link.attr("opacity", 0.7);
        label.attr("opacity", 1);
    });

    node
        .on("mouseover.tooltip", function (event, d) {
            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.station_name}</strong>
                    <br>
                    District: ${d.district}
                    <br>
                    Daily passengers: ${d.daily_passengers.toLocaleString()}
                    <br>
                    Type: ${d.station_type}
                `);
        })
        .on("mousemove.tooltip", moveTooltip)
        .on("mouseout.tooltip", hideTooltip);

    link
        .on("mouseover.tooltip", function (event, d) {
            const sourceName = d.source.station_name || endpointId(d.source);
            const targetName = d.target.station_name || endpointId(d.target);
            showTooltip(
                event,
                `<strong>${sourceName} — ${targetName}</strong><br>${d.route_type}<br>${d.travel_time_min} min`
            );
        })
        .on("mousemove.tooltip", moveTooltip)
        .on("mouseout.tooltip", hideTooltip);

    drawAssignmentLegend(svg, sizeScale, linkWidthScale, width, height);
    drawAssignmentMatrix(nodes, links);
}

function drawAssignmentLegend(svg, sizeScale, linkWidthScale, width, height) {
    const legend = svg.append("g")
        .attr("transform", `translate(${width - 250}, 36)`);

    legend.append("text")
        .attr("font-size", 14)
        .attr("font-weight", 600)
        .text("Legend");

    legend.append("text")
        .attr("y", 28)
        .attr("font-size", 12)
        .attr("font-weight", 600)
        .text("District");

    districtOrder.forEach((district, i) => {
        const row = legend.append("g")
            .attr("transform", `translate(0, ${48 + i * 20})`);
        row.append("circle")
            .attr("r", 6)
            .attr("cx", 6)
            .attr("fill", districtColors[district]);
        row.append("text")
            .attr("x", 18)
            .attr("y", 4)
            .attr("font-size", 12)
            .text(district);
    });

    legend.append("text")
        .attr("y", 168)
        .attr("font-size", 12)
        .attr("font-weight", 600)
        .text("Station type");

    ["Local", "Transfer", "Terminal"].forEach((type, i) => {
        const row = legend.append("g")
            .attr("transform", `translate(0, ${188 + i * 24})`);
        row.append("path")
            .attr("d", symbolPath(type, 7))
            .attr("transform", "translate(6,0)")
            .attr("fill", "#17211d");
        row.append("text")
            .attr("x", 22)
            .attr("y", 4)
            .attr("font-size", 12)
            .text(type);
    });

    legend.append("text")
        .attr("y", 276)
        .attr("font-size", 12)
        .attr("font-weight", 600)
        .text("Daily passengers");

    const passengerTicks = d3.extent(sizeScale.domain());
    passengerTicks.forEach((value, i) => {
        const radius = sizeScale(value);
        const row = legend.append("g")
            .attr("transform", `translate(0, ${300 + i * 32})`);
        row.append("circle")
            .attr("r", radius)
            .attr("cx", 12)
            .attr("fill", "#3b6755")
            .attr("fill-opacity", 0.35)
            .attr("stroke", "#3b6755");
        row.append("text")
            .attr("x", 36)
            .attr("y", 4)
            .attr("font-size", 12)
            .text(value.toLocaleString());
    });

    legend.append("text")
        .attr("y", 384)
        .attr("font-size", 12)
        .attr("font-weight", 600)
        .text("Route type");

    Object.keys(routeColors).forEach((type, i) => {
        const row = legend.append("g")
            .attr("transform", `translate(0, ${404 + i * 20})`);
        row.append("line")
            .attr("x1", 0)
            .attr("x2", 28)
            .attr("y1", 0)
            .attr("y2", 0)
            .attr("stroke", routeColors[type])
            .attr("stroke-width", 3)
            .attr("stroke-dasharray", type === "Shuttle" ? "5,4" : null);
        row.append("text")
            .attr("x", 36)
            .attr("y", 4)
            .attr("font-size", 12)
            .text(type);
    });

    legend.append("text")
        .attr("y", 484)
        .attr("font-size", 12)
        .attr("font-weight", 600)
        .text("Travel time");

    const timeTicks = d3.extent(linkWidthScale.domain());
    timeTicks.forEach((value, i) => {
        const row = legend.append("g")
            .attr("transform", `translate(0, ${504 + i * 20})`);
        row.append("line")
            .attr("x1", 0)
            .attr("x2", 28)
            .attr("y1", 0)
            .attr("y2", 0)
            .attr("stroke", "#17211d")
            .attr("stroke-width", linkWidthScale(value));
        row.append("text")
            .attr("x", 36)
            .attr("y", 4)
            .attr("font-size", 12)
            .text(`${value} min`);
    });

    legend.append("text")
        .attr("y", height - 80)
        .attr("font-size", 11)
        .attr("fill", "#65706b")
        .text("Numbers on nodes are station IDs.");
}

function drawAssignmentMatrix(nodes, links) {
    const ordered = nodes.slice().sort((a, b) => {
        const districtDiff = districtOrder.indexOf(a.district) - districtOrder.indexOf(b.district);
        if (districtDiff !== 0) {
            return districtDiff;
        }
        const typeDiff = typeOrder.indexOf(a.station_type) - typeOrder.indexOf(b.station_type);
        if (typeDiff !== 0) {
            return typeDiff;
        }
        return a.id.localeCompare(b.id, undefined, { numeric: true });
    });

    const matrixData = [];
    ordered.forEach(rowNode => {
        ordered.forEach(colNode => {
            const foundLink = findLink(links, rowNode.id, colNode.id);
            matrixData.push({
                row: rowNode.id,
                col: colNode.id,
                rowNode,
                colNode,
                weight: foundLink ? foundLink.travel_time_min : 0,
                type: foundLink ? foundLink.route_type : null
            });
        });
    });

    const matrixSize = 560;
    const matrixX = d3.scaleBand()
        .domain(ordered.map(d => d.id))
        .range([0, matrixSize])
        .padding(0.08);
    const matrixY = d3.scaleBand()
        .domain(ordered.map(d => d.id))
        .range([0, matrixSize])
        .padding(0.08);

    const opacityScale = d3.scaleLinear()
        .domain(d3.extent(links, d => d.travel_time_min))
        .range([0.25, 1]);

    const matrixSvg = d3.select("#matrix")
        .append("svg")
        .attr("width", 780)
        .attr("height", 780)
        .attr("viewBox", "0 0 780 780");

    const matrixGroup = matrixSvg.append("g")
        .attr("transform", "translate(120,120)");

    const cells = matrixGroup
        .selectAll("rect")
        .data(matrixData)
        .join("rect")
        .attr("x", d => matrixX(d.col))
        .attr("y", d => matrixY(d.row))
        .attr("width", matrixX.bandwidth())
        .attr("height", matrixY.bandwidth())
        .attr("fill", d => (d.weight > 0 ? routeColors[d.type] : "#f3f3f3"))
        .attr("fill-opacity", d => (d.weight > 0 ? opacityScale(d.weight) : 1));

    cells
        .on("mouseover", function (event, d) {
            cells.attr("opacity", other => (
                other.row === d.row || other.col === d.col ? 1 : 0.18
            ));
            if (d.weight > 0) {
                showTooltip(
                    event,
                    `<strong>${d.rowNode.station_name} — ${d.colNode.station_name}</strong><br>${d.type}<br>${d.weight} min`
                );
            }
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", function () {
            cells.attr("opacity", 1);
            hideTooltip();
        });

    matrixGroup
        .selectAll(".row-label")
        .data(ordered)
        .join("text")
        .attr("class", "row-label")
        .attr("x", -14)
        .attr("y", d => matrixY(d.id) + matrixY.bandwidth() / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("font-size", 8)
        .attr("fill", d => districtColors[d.district])
        .text(d => `${typeAbbrev[d.station_type]} ${d.id.replace("s", "")}`);

    matrixGroup
        .selectAll(".col-label")
        .data(ordered)
        .join("text")
        .attr("class", "col-label")
        .attr("x", d => matrixX(d.id) + matrixX.bandwidth() / 2)
        .attr("y", -12)
        .attr("text-anchor", "start")
        .attr("font-size", 8)
        .attr("fill", d => districtColors[d.district])
        .attr("transform", d => {
            const x = matrixX(d.id) + matrixX.bandwidth() / 2;
            return `rotate(-90, ${x}, -12)`;
        })
        .text(d => `${typeAbbrev[d.station_type]} ${d.id.replace("s", "")}`);

    const blockStarts = districtOrder.map(district => (
        ordered.find(d => d.district === district)
    ));

    blockStarts.forEach(station => {
        if (!station) {
            return;
        }
        matrixGroup.append("text")
            .attr("x", matrixX(station.id))
            .attr("y", matrixSize + 28)
            .attr("font-size", 11)
            .attr("font-weight", 600)
            .attr("fill", districtColors[station.district])
            .text(station.district);
    });
}

Promise.all([
    d3.csv("../data/lab5_small_nodes.csv", d => ({
        id: d.id,
        name: d.name,
        group: d.group,
        activity_count: +d.activity_count,
        level: +d.level
    })),
    d3.csv("../data/lab5_small_links.csv", d => ({
        source: d.source,
        target: d.target,
        weight: +d.weight,
        type: d.type
    }))
])
    .then(([nodes, links]) => {
        console.log(nodes);
        console.log(links);
        drawTutorial(nodes, links);
    })
    .catch(error => {
        d3.select("#chart")
            .append("p")
            .attr("class", "chart-error")
            .text(`The tutorial network could not be loaded: ${error.message}`);
    });

Promise.all([
    d3.csv("../data/lab5_assignment_stations.csv", d => ({
        id: d.id,
        station_name: d.station_name,
        district: d.district,
        daily_passengers: +d.daily_passengers,
        station_type: d.station_type
    })),
    d3.csv("../data/lab5_assignment_routes.csv", d => ({
        source: d.source,
        target: d.target,
        travel_time_min: +d.travel_time_min,
        route_type: d.route_type
    }))
])
    .then(([nodes, links]) => {
        console.log(nodes);
        console.log(links);
        drawAssignment(nodes, links);
    })
    .catch(error => {
        d3.select("#network-status").text("Data unavailable");
        d3.select("#assignment-chart")
            .append("p")
            .attr("class", "chart-error")
            .text(`The assignment network could not be loaded: ${error.message}`);
    });
