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

function featureCoords(feature) {
    const coords = [];
    const walk = node => {
        if (!node) return;
        if (typeof node[0] === "number") {
            coords.push(node);
            return;
        }
        node.forEach(walk);
    };
    walk(feature.geometry && feature.geometry.coordinates);
    return coords;
}

function quantile(values, p) {
    if (!values.length) return 0;
    const i = Math.max(0, Math.min(values.length - 1, Math.floor(p * (values.length - 1))));
    return values[i];
}

function fitProjectedCollection(features, path, width, height, pad) {
    const xs = [];
    const ys = [];
    features.forEach(feature => {
        featureCoords(feature).forEach(([x, y]) => {
            if (Number.isFinite(x) && Number.isFinite(y)) {
                xs.push(x);
                ys.push(y);
            }
        });
    });
    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);

    const x0 = quantile(xs, 0.02);
    const x1 = quantile(xs, 0.98);
    const y0 = quantile(ys, 0.045);
    const y1 = quantile(ys, 0.96);
    const boxWidth = Math.max(x1 - x0, 1);
    const boxHeight = Math.max(y1 - y0, 1);
    const scale = Math.min((width - pad * 2) / boxWidth, (height - pad * 2) / boxHeight);
    const tx = width / 2 - scale * (x0 + x1) / 2;
    const ty = height / 2 - scale * (y0 + y1) / 2;
    return `translate(${tx},${ty}) scale(${scale})`;
}

function cartogramValue(feature, floor) {
    return feature.properties.value == null ? floor : feature.properties.value;
}

function drawCartogram(geoData, colorScale, stats) {
    const status = d3.select("#cartogram-status");
    status.text("Warping the map");

    const land = {
        type: "FeatureCollection",
        features: geoData.features.filter(d => d.properties.iso3 !== "ATA")
    };
    const topology = topojson.topology({ countries: land }, 1e4);
    const projection = d3.geoNaturalEarth1()
        .fitExtent([[24, 18], [mapWidth - 24, mapHeight - 18]], land);
    const floor = d3.min(stats, d => d.value) * 0.05;

    const carto = topogram.cartogram()
        .projection(projection)
        .iterations(36)
        .properties(geom => geom.properties)
        .value(feature => cartogramValue(feature, floor));

    const warped = carto(topology, topology.objects.countries.geometries);
    const path = carto.path;

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
    frame.append("clipPath")
        .attr("id", "cartogram-clip")
        .append("rect")
        .attr("width", mapWidth)
        .attr("height", mapHeight);

    const clipped = frame.append("g").attr("clip-path", "url(#cartogram-clip)");
    const mapGroup = clipped.append("g")
        .attr("class", "map-layer")
        .attr("transform", fitProjectedCollection(warped.features, path, mapWidth, mapHeight, 6));

    const countries = mapGroup.selectAll(".country")
        .data(warped.features)
        .join("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("fill", d => featureFill(d, colorScale))
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.6);

    bindCountryEvents(countries, colorScale);

    svg.on("click", function () {
        state.pinnedId = null;
        d3.select("#country-select").property("value", "");
        setActive(null);
    });

    status.text("Area encodes GDP");
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
    drawCartogram(geoData, colorScale, stats);
}).catch(error => {
    d3.select("#join-status").text("Could not load map data");
    d3.select("#choropleth").append("p")
        .attr("class", "chart-error")
        .text(`The maps could not be drawn. ${error.message}`);
});
