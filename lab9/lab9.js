const tooltip = d3.select("#tooltip");
const missingFill = "#e6e1d6";
const mapWidth = 1000;
const mapHeight = 560;

const state = {
    activeId: null,
    pinnedId: null,
    zoom: null,
    choroplethSvg: null
};

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

function formatGdp(value) {
    if (value == null || Number.isNaN(value)) {
        return "No data";
    }
    return `$${d3.format(",.1f")(value)} billion`;
}

function tooltipHtml(d) {
    const value = d.properties.value;
    const rank = d.properties.rank;
    return `
        <strong>${d.properties.name}</strong><br>
        ISO-3: ${d.properties.iso3}<br>
        2025 GDP: ${formatGdp(value)}
        ${rank ? `<br>Rank: ${rank}` : ""}
        ${value == null ? "<br>Not in the top-50 file" : ""}
    `;
}

function featureFill(d, colorScale) {
    return d.properties.value == null ? missingFill : colorScale(d.properties.value);
}

function setActive(iso3) {
    state.activeId = iso3;
    d3.selectAll(".country")
        .classed("is-active", d => iso3 && d.properties.iso3 === iso3)
        .attr("stroke", d => iso3 && d.properties.iso3 === iso3 ? "#111111" : "#ffffff")
        .attr("stroke-width", d => iso3 && d.properties.iso3 === iso3 ? 2 : 0.7);

    const label = d3.select("#active-country");
    if (!iso3) {
        label.text("Hover or click a country to highlight it in both maps.");
        return;
    }
    const node = d3.selectAll(".country").data().find(d => d.properties.iso3 === iso3);
    if (!node) {
        label.text(iso3);
        return;
    }
    const valueText = node.properties.value == null
        ? "no GDP value in the provided file"
        : `${formatGdp(node.properties.value)}${node.properties.rank ? ` · rank ${node.properties.rank}` : ""}`;
    label.text(`${node.properties.name} · ${valueText}`);
}

function bindCountryEvents(selection, colorScale) {
    selection
        .on("mouseover", function (event, d) {
            if (!state.pinnedId) {
                setActive(d.properties.iso3);
            } else if (state.pinnedId !== d.properties.iso3) {
                d3.select(this)
                    .attr("stroke", "#111111")
                    .attr("stroke-width", 2);
            }
            showTooltip(event, tooltipHtml(d));
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", function (event, d) {
            hideTooltip();
            if (state.pinnedId) {
                setActive(state.pinnedId);
                return;
            }
            setActive(null);
        })
        .on("click", function (event, d) {
            event.stopPropagation();
            if (state.pinnedId === d.properties.iso3) {
                state.pinnedId = null;
                d3.select("#country-select").property("value", "");
                setActive(null);
                hideTooltip();
                return;
            }
            state.pinnedId = d.properties.iso3;
            d3.select("#country-select").property("value", d.properties.iso3);
            setActive(d.properties.iso3);
        });
}

function landForFit(geoData) {
    return {
        type: "FeatureCollection",
        features: geoData.features.filter(d => d.properties.iso3 !== "ATA")
    };
}

function drawLegend(colorScale, values) {
    const width = 420;
    const height = 58;
    const margin = { top: 18, right: 16, bottom: 22, left: 16 };
    const innerWidth = width - margin.left - margin.right;

    const holder = d3.select("#choropleth-legend");
    holder.selectAll("*").remove();
    const svg = holder.append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "presentation");

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient").attr("id", "gdp-legend");
    const stops = d3.range(0, 1.01, 0.05);
    const logMin = Math.log(d3.min(values));
    const logMax = Math.log(d3.max(values));
    gradient.selectAll("stop")
        .data(stops)
        .join("stop")
        .attr("offset", d => `${d * 100}%`)
        .attr("stop-color", d => colorScale(Math.exp(logMin + d * (logMax - logMin))));

    svg.append("rect")
        .attr("x", margin.left)
        .attr("y", 8)
        .attr("width", innerWidth)
        .attr("height", 12)
        .attr("fill", "url(#gdp-legend)")
        .attr("stroke", "#17211d")
        .attr("stroke-width", 0.6);

    const legendScale = d3.scaleLog()
        .domain(d3.extent(values))
        .range([margin.left, margin.left + innerWidth]);

    svg.append("g")
        .attr("transform", "translate(0, 20)")
        .call(
            d3.axisBottom(legendScale)
                .tickValues([300, 600, 1000, 2000, 4000, 10000, 20000, 30000])
                .tickFormat(d => `$${d3.format("~s")(d)}b`)
                .tickSize(6)
        )
        .select(".domain")
        .attr("stroke", "#17211d");

    svg.append("text")
        .attr("x", margin.left)
        .attr("y", 52)
        .attr("fill", "#65706b")
        .attr("font-size", 11)
        .text("2025 nominal GDP, log scale · gray = no data in the top-50 file");
}

function drawChoropleth(geoData, colorScale) {
    const projection = d3.geoNaturalEarth1()
        .fitSize([mapWidth, mapHeight], landForFit(geoData));
    const path = d3.geoPath().projection(projection);

    const svg = d3.select("#choropleth")
        .append("svg")
        .attr("viewBox", `0 0 ${mapWidth} ${mapHeight + 36}`)
        .attr("role", "presentation");

    svg.append("text")
        .attr("class", "map-title")
        .attr("x", 16)
        .attr("y", 24)
        .text("2025 Nominal GDP · Choropleth");

    const frame = svg.append("g").attr("transform", "translate(0, 28)");
    const mapGroup = frame.append("g").attr("class", "map-layer");

    mapGroup.append("path")
        .datum({ type: "Sphere" })
        .attr("class", "ocean")
        .attr("d", path);

    const countries = mapGroup.selectAll(".country")
        .data(geoData.features)
        .join("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("fill", d => featureFill(d, colorScale))
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.7);

    bindCountryEvents(countries, colorScale);

    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .translateExtent([[-80, -80], [mapWidth + 80, mapHeight + 80]])
        .on("zoom", function (event) {
            mapGroup.attr("transform", event.transform);
        });

    svg.call(zoom);
    state.zoom = zoom;
    state.choroplethSvg = svg;

    svg.on("click", function () {
        state.pinnedId = null;
        d3.select("#country-select").property("value", "");
        setActive(null);
    });

    return countries;
}

function largestPiece(feature) {
    if (feature.geometry.type !== "MultiPolygon") {
        return feature;
    }
    return feature.geometry.coordinates
        .map(coordinates => ({
            type: "Feature",
            properties: feature.properties,
            geometry: { type: "Polygon", coordinates }
        }))
        .sort((a, b) => d3.geoArea(b) - d3.geoArea(a))[0];
}

function drawCartogram(geoData, colorScale) {
    const valued = geoData.features.filter(d => d.properties.value != null);
    const pieces = valued.map(feature => ({
        feature,
        piece: largestPiece(feature)
    }));
    const projection = d3.geoNaturalEarth1()
        .fitExtent([[48, 40], [mapWidth - 48, mapHeight - 36]], {
            type: "FeatureCollection",
            features: pieces.map(d => d.piece)
        });
    const path = d3.geoPath().projection(projection);

    const svg = d3.select("#cartogram")
        .append("svg")
        .attr("viewBox", `0 0 ${mapWidth} ${mapHeight + 36}`)
        .attr("role", "presentation");

    svg.append("text")
        .attr("class", "map-title")
        .attr("x", 16)
        .attr("y", 24)
        .text("2025 Nominal GDP · Cartogram · area represents GDP");

    const frame = svg.append("g").attr("transform", "translate(0, 28)");
    frame.append("rect")
        .attr("class", "ocean")
        .attr("width", mapWidth)
        .attr("height", mapHeight);

    const available = mapWidth * mapHeight * 0.30;
    const sumGdp = d3.sum(valued, d => d.properties.value);
    const targetArea = d => Math.max(80, available * (d.properties.value / sumGdp));

    const nodes = pieces.map(({ feature, piece }) => {
        const centroid = path.centroid(piece);
        const geoArea = Math.max(path.area(piece), 1);
        const area = targetArea(feature);
        const k = Math.sqrt(area / geoArea);
        const bounds = path.bounds(piece);
        const halfW = ((bounds[1][0] - bounds[0][0]) * k) / 2;
        const halfH = ((bounds[1][1] - bounds[0][1]) * k) / 2;
        return {
            feature,
            piece,
            properties: feature.properties,
            cx: centroid[0],
            cy: centroid[1],
            x: centroid[0],
            y: centroid[1],
            k,
            r: Math.max(Math.hypot(halfW, halfH) * 0.72, Math.sqrt(area / Math.PI))
        };
    });

    const simulation = d3.forceSimulation(nodes)
        .force("x", d3.forceX(d => d.cx).strength(0.12))
        .force("y", d3.forceY(d => d.cy).strength(0.12))
        .force("collide", d3.forceCollide(d => d.r + 2.5).iterations(6))
        .stop();

    for (let i = 0; i < 220; i += 1) {
        simulation.tick();
    }

    nodes.forEach(node => {
        node.x = Math.max(node.r + 8, Math.min(mapWidth - node.r - 8, node.x));
        node.y = Math.max(node.r + 8, Math.min(mapHeight - node.r - 8, node.y));
    });

    const countries = frame.selectAll(".country")
        .data(nodes)
        .join("path")
        .attr("class", "country")
        .datum(d => d.feature)
        .attr("d", (d, i) => path(nodes[i].piece))
        .attr("fill", d => featureFill(d, colorScale))
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.7)
        .attr("transform", (d, i) => {
            const node = nodes[i];
            return `translate(${node.x},${node.y}) scale(${node.k}) translate(${-node.cx},${-node.cy})`;
        });

    bindCountryEvents(countries, colorScale);

    frame.selectAll(".cartogram-label")
        .data(nodes.filter(d => d.properties.rank <= 12 || d.r > 36))
        .join("text")
        .attr("class", "cartogram-label")
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .attr("dy", "0.35em")
        .text(d => d.properties.name);

    svg.on("click", function () {
        state.pinnedId = null;
        d3.select("#country-select").property("value", "");
        setActive(null);
    });

    return countries;
}

function populateSelect(stats) {
    const select = d3.select("#country-select");
    select.selectAll("option.country-option")
        .data(stats)
        .join("option")
        .attr("class", "country-option")
        .attr("value", d => d.iso3)
        .text(d => `${d.rank}. ${d.country}`);

    select.on("change", function () {
        const iso3 = this.value || null;
        state.pinnedId = iso3;
        setActive(iso3);
    });
}

d3.select("#reset-view").on("click", function () {
    state.pinnedId = null;
    d3.select("#country-select").property("value", "");
    setActive(null);
    if (state.choroplethSvg && state.zoom) {
        state.choroplethSvg.transition().duration(400).call(state.zoom.transform, d3.zoomIdentity);
    }
});

Promise.all([
    d3.json("../data/world.geojson"),
    d3.csv("../data/lab9_gdp_2025_top50.csv", d => ({
        iso3: d.iso3,
        country: d.country,
        value: +d.gdp_2025_billion_usd,
        rank: +d.rank
    }))
]).then(([geoData, stats]) => {
    const valueById = new Map(stats.map(d => [d.iso3, d]));

    geoData.features.forEach(feature => {
        const row = valueById.get(feature.properties.iso3);
        feature.properties.value = row ? row.value : undefined;
        feature.properties.rank = row ? row.rank : undefined;
        if (row) {
            feature.properties.name = row.country;
        }
    });

    const matched = stats.filter(d => geoData.features.some(f => f.properties.iso3 === d.iso3));
    d3.select("#join-status").text(`Joined ${matched.length} / ${stats.length} ISO-3 codes`);

    const values = stats.map(d => d.value);
    const colorScale = d3.scaleSequentialLog(d3.interpolateBlues)
        .domain(d3.extent(values));

    populateSelect(stats);
    drawLegend(colorScale, values);
    drawChoropleth(geoData, colorScale);
    drawCartogram(geoData, colorScale);
}).catch(error => {
    d3.select("#join-status").text("Could not load map data");
    d3.select("#choropleth").append("p")
        .attr("class", "chart-error")
        .text(`The maps could not be drawn. ${error.message}`);
});
