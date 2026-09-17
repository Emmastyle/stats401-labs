const tooltip = d3.select("#tooltip");
const dateFormat = d3.timeFormat("%Y-%m-%d");
const dateParse = d3.timeParse("%Y-%m-%d");
const moneyFormat = d3.format("$,.0f");

const metricLabels = {
    temperature_c: "Temperature (°C)",
    humidity_pct: "Humidity (%)",
    wind_speed_mps: "Wind Speed (m/s)",
    pressure_hpa: "Pressure (hPa)",
    precipitation_mm: "Precipitation (mm)"
};

const sectorColors = {
    Manufacturing: "#4e79a7",
    Logistics: "#f28e2b",
    Retail: "#e15759",
    Food: "#76b7b2",
    Technology: "#59a14f",
    Wholesale: "#edc948",
    Materials: "#b07aa1"
};

const regionSymbols = {
    Asia: d3.symbolCircle,
    Europe: d3.symbolSquare,
    "North America": d3.symbolDiamond
};

const regionX = {
    Asia: 0.22,
    Europe: 0.50,
    "North America": 0.78
};

const typeColors = d3.scaleOrdinal()
    .domain(["goods", "shipping", "components", "materials", "services"])
    .range(d3.schemeSet2);

function showTooltip(event, html) {
    tooltip
        .style("opacity", 1)
        .html(html)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY + 12}px`);
}

function moveTooltip(event) {
    tooltip
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY + 12}px`);
}

function hideTooltip() {
    tooltip.style("opacity", 0);
}

function endpointId(end) {
    return typeof end === "object" ? end.id : end;
}

function calculateVolume(companyId, currentLinks) {
    return d3.sum(
        currentLinks.filter(d =>
            endpointId(d.source) === companyId ||
            endpointId(d.target) === companyId
        ),
        d => d.amount_usd
    );
}

function linkKey(d) {
    return `${endpointId(d.source)}-${endpointId(d.target)}`;
}

function dragStarted(event, d, simulation) {
    if (!event.active) {
        simulation.alphaTarget(0.2).restart();
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

function drawWeather(data) {
    const selectedCities = [
        "Tokyo",
        "London",
        "New York"
    ];

    const filteredDataAll = data
        .filter(d => selectedCities.includes(d.city))
        .sort((a, b) => d3.ascending(a.date, b.date));

    const fullExtent = d3.extent(filteredDataAll, d => d.date);
    let startDate = fullExtent[0];
    let endDate = fullExtent[1];
    let metric = "temperature_c";
    let currentIndex = 0;
    let timer = null;

    d3.select("#start-date")
        .attr("min", dateFormat(fullExtent[0]))
        .attr("max", dateFormat(fullExtent[1]))
        .property("value", dateFormat(fullExtent[0]));

    d3.select("#end-date")
        .attr("min", dateFormat(fullExtent[0]))
        .attr("max", dateFormat(fullExtent[1]))
        .property("value", dateFormat(fullExtent[1]));

    const width = 900;
    const height = 500;
    const contextHeight = 64;

    const margin = {
        top: 40,
        right: 40,
        bottom: 70,
        left: 70
    };

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height + contextHeight + 28)
        .attr("viewBox", `0 0 ${width} ${height + contextHeight + 28}`)
        .attr("role", "img")
        .attr("aria-label", "Weather line chart for Tokyo, London, and New York");

    const colorScale = d3.scaleOrdinal()
        .domain(selectedCities)
        .range(d3.schemeTableau10);

    const xScale = d3.scaleTime()
        .range([
            margin.left,
            width - margin.right
        ]);

    const yScale = d3.scaleLinear()
        .range([
            height - margin.bottom,
            margin.top
        ]);

    const xContext = d3.scaleTime()
        .domain(fullExtent)
        .range([
            margin.left,
            width - margin.right
        ]);

    const yContext = d3.scaleLinear()
        .range([height + 18 + contextHeight - 22, height + 18]);

    const line = d3.line()
        .x(d => xScale(d.date))
        .y(d => yScale(d[metric]));

    const contextLine = d3.line()
        .x(d => xContext(d.date))
        .y(d => yContext(d.temperature_c));

    const xAxisG = svg.append("g")
        .attr("class", "x-axis")
        .attr(
            "transform",
            `translate(0,${height - margin.bottom})`
        );

    const yAxisG = svg.append("g")
        .attr("class", "y-axis")
        .attr(
            "transform",
            `translate(${margin.left},0)`
        );

    const yLabel = svg.append("text")
        .attr("class", "axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -(margin.top + (height - margin.top - margin.bottom) / 2))
        .attr("y", 18)
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("fill", "#65706b");

    svg.append("text")
        .attr("class", "axis-title")
        .attr("x", (margin.left + width - margin.right) / 2)
        .attr("y", height - 18)
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("fill", "#65706b")
        .text("Date");

    const lineGroup = svg.append("g")
        .attr("class", "city-lines");

    const hoverLine = svg.append("line")
        .attr("class", "hover-line")
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom)
        .attr("stroke", "#17211d")
        .attr("stroke-opacity", 0.25)
        .attr("stroke-dasharray", "3,3")
        .style("display", "none");

    const hoverDots = svg.append("g")
        .attr("class", "hover-dots");

    const marker = svg.append("circle")
        .attr("r", 7)
        .attr("fill", "red")
        .attr("stroke", "#f4f1e9")
        .attr("stroke-width", 1.5);

    const dateLabel = svg.append("text")
        .attr("x", width - 160)
        .attr("y", 40)
        .attr("font-size", 20)
        .attr("fill", "#17211d");

    const legend = svg.append("g")
        .attr("transform", `translate(${margin.left + 8}, ${margin.top - 16})`);

    selectedCities.forEach((city, i) => {
        const item = legend.append("g")
            .attr("transform", `translate(${i * 120}, 0)`);
        item.append("line")
            .attr("x1", 0)
            .attr("x2", 18)
            .attr("stroke", colorScale(city))
            .attr("stroke-width", 3);
        item.append("text")
            .attr("x", 24)
            .attr("y", 4)
            .attr("font-size", 12)
            .text(city);
    });

    const tokyoFull = filteredDataAll
        .filter(d => d.city === "Tokyo")
        .sort((a, b) => d3.ascending(a.date, b.date));

    yContext.domain(d3.extent(tokyoFull, d => d.temperature_c)).nice();

    const context = svg.append("g")
        .attr("class", "context");

    context.append("path")
        .datum(tokyoFull)
        .attr("fill", "none")
        .attr("stroke", colorScale("Tokyo"))
        .attr("stroke-width", 1.2)
        .attr("d", contextLine);

    context.append("g")
        .attr("transform", `translate(0,${height + 18 + contextHeight - 22})`)
        .call(
            d3.axisBottom(xContext)
                .ticks(8)
                .tickSize(4)
        );

    const brush = d3.brushX()
        .extent([
            [margin.left, height + 18],
            [
                width - margin.right,
                height + 18 + contextHeight - 22
            ]
        ])
        .on("end", brushed);

    const brushG = context.append("g")
        .attr("class", "weather-brush")
        .call(brush);

    const overlay = svg.append("rect")
        .attr("class", "hover-overlay")
        .attr("fill", "transparent")
        .attr("x", margin.left)
        .attr("y", margin.top)
        .attr("width", width - margin.left - margin.right)
        .attr("height", height - margin.top - margin.bottom)
        .style("cursor", "crosshair")
        .on("mousemove", moved)
        .on("mouseleave", () => {
            hideTooltip();
            hoverLine.style("display", "none");
            hoverDots.selectAll("circle").style("display", "none");
        });

    const bisectDate = d3.bisector(d => d.date).center;

    function rangeData() {
        return filteredDataAll.filter(
            d => d.date >= startDate && d.date <= endDate
        );
    }

    function tokyoData() {
        return rangeData()
            .filter(d => d.city === "Tokyo")
            .sort((a, b) => d3.ascending(a.date, b.date));
    }

    function groupedCities() {
        return Array.from(d3.group(rangeData(), d => d.city));
    }

    function applyRangeDates(nextStart, nextEnd) {
        if (!nextStart || !nextEnd) {
            return;
        }
        nextStart = d3.timeDay.floor(nextStart);
        nextEnd = d3.timeDay.floor(nextEnd);
        if (nextStart > nextEnd) {
            const swap = nextStart;
            nextStart = nextEnd;
            nextEnd = swap;
        }
        startDate = nextStart;
        endDate = nextEnd;
        d3.select("#start-date").property("value", dateFormat(startDate));
        d3.select("#end-date").property("value", dateFormat(endDate));
        currentIndex = 0;
        updateChart(metric, false);
        showFrame(0);
    }

    function brushed(event) {
        if (!event.selection) {
            return;
        }

        const [x0, x1] = event.selection;
        const brushedStart = xContext.invert(x0);
        const brushedEnd = xContext.invert(x1);
        console.log(brushedStart, brushedEnd);
        applyRangeDates(brushedStart, brushedEnd);
    }

    function updateChart(nextMetric, animate = true) {
        metric = nextMetric;
        const filteredData = rangeData();
        const cityData = tokyoData();
        const grouped = groupedCities();

        xScale.domain(d3.extent(filteredData, d => d.date));

        yScale
            .domain(
                d3.extent(
                    filteredData,
                    d => d[metric]
                )
            )
            .nice();

        line.y(d => yScale(d[metric]));

        const axisTransition = animate
            ? selection => selection.transition().duration(600)
            : selection => selection;

        axisTransition(xAxisG).call(
            d3.axisBottom(xScale)
                .ticks(8)
        );
        axisTransition(yAxisG).call(d3.axisLeft(yScale));
        yLabel.text(metricLabels[metric]);

        const paths = lineGroup
            .selectAll(".city-line")
            .data(grouped, d => d[0]);

        paths.join(
            enter => enter
                .append("path")
                .attr("class", "city-line")
                .attr("fill", "none")
                .attr("stroke", d => colorScale(d[0]))
                .attr("stroke-width", 2)
                .attr("d", d => line(d[1])),
            update => {
                (animate ? update.transition().duration(600) : update)
                    .attr("d", d => line(d[1]));
                return update;
            },
            exit => exit.remove()
        );

        d3.select("#time-slider")
            .attr("max", Math.max(cityData.length - 1, 0))
            .property("value", currentIndex);

        hoverDots
            .selectAll("circle")
            .data(selectedCities)
            .join("circle")
            .attr("r", 4.5)
            .attr("fill", d => colorScale(d))
            .attr("stroke", "#f4f1e9")
            .style("display", "none")
            .style("pointer-events", "none");
    }

    function showFrame(index) {
        const cityData = tokyoData();
        const safeIndex = Math.max(0, Math.min(index, cityData.length - 1));
        const d = cityData[safeIndex];
        if (!d) {
            return;
        }

        marker
            .attr("cx", xScale(d.date))
            .attr("cy", yScale(d[metric]));

        dateLabel.text(dateFormat(d.date));

        d3.select("#time-slider")
            .property("value", safeIndex);

        d3.select("#weather-date-key")
            .text(`Date: ${dateFormat(d.date)}`);
    }

    function play() {
        if (timer) {
            return;
        }

        const cityData = tokyoData();
        if (currentIndex >= cityData.length) {
            currentIndex = 0;
        }
        timer = d3.interval(
            () => {
                showFrame(currentIndex);
                currentIndex += 1;
                if (currentIndex >= cityData.length) {
                    pause();
                }
            },
            150
        );
    }

    function pause() {
        if (timer) {
            timer.stop();
            timer = null;
        }
    }

    function reset() {
        pause();
        currentIndex = 0;
        showFrame(0);
    }

    function moved(event) {
        const cityData = tokyoData();
        if (!cityData.length) {
            return;
        }

        const [mouseX] = d3.pointer(event);
        const date = xScale.invert(mouseX);
        const index = bisectDate(cityData, date);
        const d = cityData[index];
        if (!d) {
            return;
        }

        hoverLine
            .style("display", null)
            .attr("x1", xScale(d.date))
            .attr("x2", xScale(d.date));

        const rows = selectedCities.map(city =>
            rangeData().find(row =>
                row.city === city && +row.date === +d.date
            )
        ).filter(Boolean);

        hoverDots.selectAll("circle")
            .style("display", null)
            .attr("cx", xScale(d.date))
            .attr("cy", city => {
                const row = rows.find(r => r.city === city);
                return row ? yScale(row[metric]) : 0;
            });

        const metricName = metricLabels[metric];
        const cityLines = rows.map(row =>
            `${row.city}: ${row[metric]}`
        ).join("<br>");

        showTooltip(event, `
            <strong>${d.city}</strong><br>
            ${dateFormat(d.date)}<br>
            Temperature: ${d.temperature_c} °C<br>
            Humidity: ${d.humidity_pct}%<br>
            Wind: ${d.wind_speed_mps} m/s<br>
            Pressure: ${d.pressure_hpa} hPa
            <hr style="border:none;border-top:1px solid #ddd;margin:6px 0;">
            ${metricName}<br>
            ${cityLines}
        `);
    }

    d3.select("#metric")
        .on("change", function () {
            updateChart(this.value);
            showFrame(currentIndex);
        });

    d3.select("#apply-range")
        .on("click", () => {
            const nextStart = dateParse(d3.select("#start-date").property("value"));
            const nextEnd = dateParse(d3.select("#end-date").property("value"));
            brushG.call(brush.move, [
                xContext(nextStart < nextEnd ? nextStart : nextEnd),
                xContext(nextStart < nextEnd ? nextEnd : nextStart)
            ]);
            applyRangeDates(nextStart, nextEnd);
        });

    d3.select("#play")
        .on("click", play);

    d3.select("#pause")
        .on("click", pause);

    d3.select("#reset")
        .on("click", reset);

    d3.select("#time-slider")
        .on("input", function () {
            pause();
            currentIndex = +this.value;
            showFrame(currentIndex);
        });

    overlay.on("mousemove", moved);

    updateChart(metric, false);
    showFrame(0);
    d3.select("#weather-status").text("8 cities · 180 days");
}

function drawNetwork(companies, transactions) {
    companies.forEach(company => {
        company.volume = 0;
    });

    const companyById = new Map(companies.map(d => [d.id, d]));
    const maxDay = d3.max(transactions, d => d.day);
    const days = d3.range(1, maxDay + 1);

    const maxVolume = d3.max(days, day => {
        const links = transactions.filter(d => d.day === day);
        return d3.max(companies, company => calculateVolume(company.id, links));
    });

    const width = 900;
    const height = 560;

    const svg = d3.select("#assignment-chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "img")
        .attr("aria-label", "Animated commercial network of 12 companies");

    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "#f8f5ef");

    ["Asia", "Europe", "North America"].forEach(region => {
        svg.append("text")
            .attr("x", width * regionX[region])
            .attr("y", 28)
            .attr("text-anchor", "middle")
            .attr("fill", "#65706b")
            .attr("font-size", 12)
            .attr("letter-spacing", "0.08em")
            .text(region.toUpperCase());
    });

    const dateLabel = svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 18)
        .attr("text-anchor", "middle")
        .attr("font-size", 20)
        .attr("font-weight", 600)
        .attr("fill", "#17211d")
        .style("pointer-events", "none");

    const sizeScale = d3.scaleSqrt()
        .domain([0, maxVolume])
        .range([40, 420]);

    const radiusScale = d3.scaleSqrt()
        .domain([0, maxVolume])
        .range([8, 22]);

    const widthScale = d3.scaleLinear()
        .domain(d3.extent(transactions, d => d.amount_usd))
        .range([1.5, 8]);

    const linkGroup = svg.append("g")
        .attr("class", "links");

    const nodeGroup = svg.append("g")
        .attr("class", "nodes");

    let link = linkGroup.selectAll("line");

    companies.forEach(company => {
        company.x = width * regionX[company.region] + (Math.random() - 0.5) * 80;
        company.y = height / 2 + (Math.random() - 0.5) * 160;
    });

    const uniquePairs = Array.from(
        new Map(
            transactions.map(d => {
                const key = [d.sourceId, d.targetId].sort().join("-");
                return [key, { source: d.sourceId, target: d.targetId }];
            })
        ).values()
    );

    const simulation = d3.forceSimulation(companies)
        .force(
            "link",
            d3.forceLink(uniquePairs)
                .id(d => d.id)
                .distance(130)
                .strength(0.25)
        )
        .force(
            "charge",
            d3.forceManyBody()
                .strength(-220)
        )
        .force(
            "center",
            d3.forceCenter(width / 2, height / 2 + 8)
        )
        .force(
            "x",
            d3.forceX(d => width * regionX[d.region])
                .strength(0.18)
        )
        .force(
            "y",
            d3.forceY(height / 2 + 8)
                .strength(0.05)
        )
        .force(
            "collide",
            d3.forceCollide()
                .radius(d => radiusScale(d.volume) + 18)
        )
        .stop();

    for (let i = 0; i < 220; i += 1) {
        simulation.tick();
    }

    const node = nodeGroup
        .selectAll(".company-node")
        .data(companies, d => d.id)
        .join("g")
        .attr("class", "company-node network-node")
        .attr("transform", d => `translate(${d.x},${d.y})`);

    node.append("path")
        .attr("class", "company-shape")
        .attr("stroke", "#17211d")
        .attr("stroke-opacity", 0.85);

    node.append("text")
        .attr("class", "company-label")
        .attr("text-anchor", "middle")
        .attr("dy", 28)
        .attr("font-size", 11)
        .attr("fill", "#17211d")
        .style("pointer-events", "none")
        .text(d => d.company_name.split(" ")[0]);

    node.call(
        d3.drag()
            .on("start", (event, d) => dragStarted(event, d, simulation))
            .on("drag", dragged)
            .on("end", (event, d) => dragEnded(event, d, simulation))
    );

    node.on("mouseover", (event, d) => {
        showTooltip(event, `
            <strong>${d.company_name}</strong><br>
            Sector: ${d.sector}<br>
            Region: ${d.region}<br>
            Volume today: ${moneyFormat(d.volume)}<br>
            Active links: ${d.degree}
        `);
    })
        .on("mousemove", moveTooltip)
        .on("mouseleave", hideTooltip);

    simulation.on("tick", () => {
        node.each(d => {
            d.x = Math.max(48, Math.min(width - 48, d.x));
            d.y = Math.max(48, Math.min(height - 48, d.y));
        });

        linkGroup.selectAll("line")
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    let currentDay = 1;
    let timer = null;

    function linksForDay(day) {
        return transactions
            .filter(d => d.day === day)
            .map(d => ({
                date: d.date,
                day: d.day,
                source: d.sourceId,
                target: d.targetId,
                sourceId: d.sourceId,
                targetId: d.targetId,
                amount_usd: d.amount_usd,
                transaction_type: d.transaction_type,
                transaction_count: d.transaction_count
            }));
    }

    function updateNetwork(nodes, currentLinks) {
        nodes.forEach(company => {
            company.volume = calculateVolume(company.id, currentLinks);
            company.degree = currentLinks.filter(d =>
                endpointId(d.source) === company.id ||
                endpointId(d.target) === company.id
            ).length;
        });

        link = linkGroup
            .selectAll("line")
            .data(currentLinks, d => linkKey(d))
            .join(
                enter => enter
                    .append("line")
                    .attr("x1", d => companyById.get(d.sourceId).x)
                    .attr("y1", d => companyById.get(d.sourceId).y)
                    .attr("x2", d => companyById.get(d.targetId).x)
                    .attr("y2", d => companyById.get(d.targetId).y)
                    .attr("stroke", d => typeColors(d.transaction_type))
                    .attr("stroke-width", d => widthScale(d.amount_usd))
                    .attr("stroke-linecap", "round")
                    .attr("opacity", 0)
                    .call(enterSel => enterSel
                        .transition()
                        .duration(400)
                        .attr("opacity", 0.7)
                    ),
                update => update
                    .attr("stroke", d => typeColors(d.transaction_type))
                    .attr("stroke-width", d => widthScale(d.amount_usd)),
                exit => exit
                    .transition()
                    .duration(400)
                    .attr("opacity", 0)
                    .remove()
            );

        link
            .on("mouseover", (event, d) => {
                const source = companyById.get(endpointId(d.source));
                const target = companyById.get(endpointId(d.target));
                const cross = source.region !== target.region;
                showTooltip(event, `
                    <strong>${source.company_name} — ${target.company_name}</strong><br>
                    Type: ${d.transaction_type}<br>
                    Amount: ${moneyFormat(d.amount_usd)}<br>
                    Transactions: ${d.transaction_count}<br>
                    Regions: ${source.region} / ${target.region}<br>
                    ${cross ? "Cross-regional" : "Same region"}
                `);
            })
            .on("mousemove", moveTooltip)
            .on("mouseleave", hideTooltip);

        nodeGroup.raise();
        dateLabel.raise();

        node.select(".company-shape")
            .attr("fill", d => sectorColors[d.sector])
            .attr("fill-opacity", d => d.volume > 0 ? 0.95 : 0.28)
            .attr("stroke-width", d => d.volume > 0 ? 2.8 : 1)
            .attr("d", d => d3.symbol()
                .type(regionSymbols[d.region])
                .size(sizeScale(d.volume))()
            );

        node.select(".company-label")
            .attr("dy", d => radiusScale(d.volume) + 14)
            .attr("fill-opacity", d => d.volume > 0 ? 1 : 0.45);

        simulation.nodes(nodes);
        simulation.force("link").links(currentLinks);
        simulation.force("collide").radius(d => radiusScale(d.volume) + 18);
        simulation.alpha(0.3).restart();
    }

    function showDay(day) {
        const currentLinks = linksForDay(day);
        const sample = currentLinks[0];
        const dayDate = sample ? dateFormat(sample.date) : "";

        updateNetwork(companies, currentLinks);

        dateLabel.text(`Day ${day} · ${dayDate}`);
        d3.select("#network-slider").property("value", day);
        d3.select("#network-day-key").text(`Day ${day} · ${dayDate}`);

        const totalValue = d3.sum(currentLinks, d => d.amount_usd);
        const activeCompanies = new Set(
            currentLinks.flatMap(d => [
                endpointId(d.source),
                endpointId(d.target)
            ])
        ).size;
        const crossRegional = currentLinks.filter(d => {
            const source = companyById.get(endpointId(d.source));
            const target = companyById.get(endpointId(d.target));
            return source.region !== target.region;
        }).length;

        d3.select("#summary-day").text(`Day ${day} · ${dayDate}`);
        d3.select("#summary-companies").text(activeCompanies);
        d3.select("#summary-links").text(currentLinks.length);
        d3.select("#summary-value").text(moneyFormat(totalValue));
        d3.select("#summary-cross").text(`${crossRegional} / ${currentLinks.length}`);
    }

    function play() {
        if (timer) {
            return;
        }
        if (currentDay > maxDay) {
            currentDay = 1;
        }
        showDay(currentDay);
        timer = d3.interval(
            () => {
                currentDay += 1;
                if (currentDay > maxDay) {
                    pause();
                    return;
                }
                showDay(currentDay);
            },
            650
        );
    }

    function pause() {
        if (timer) {
            timer.stop();
            timer = null;
        }
    }

    function reset() {
        pause();
        currentDay = 1;
        showDay(1);
    }

    d3.select("#network-play").on("click", play);
    d3.select("#network-pause").on("click", pause);
    d3.select("#network-reset").on("click", reset);
    d3.select("#network-slider").on("input", function () {
        pause();
        currentDay = +this.value;
        showDay(currentDay);
    });

    showDay(1);
    d3.select("#network-status").text("12 companies · 60 days");
}

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
        drawWeather(data);
    })
    .catch(error => {
        d3.select("#weather-status").text("Could not load weather data");
        d3.select("#chart")
            .append("p")
            .attr("class", "chart-error")
            .text(error.message);
    });

Promise.all([
    d3.csv("../data/lab7_assignment_companies.csv", d => ({
        id: d.id,
        company_name: d.company_name,
        sector: d.sector,
        region: d.region
    })),
    d3.csv("../data/lab7_assignment_transactions_60days.csv", d => ({
        date: d3.timeParse("%Y-%m-%d")(d.date),
        day: +d.day,
        source: d.source,
        target: d.target,
        sourceId: d.source,
        targetId: d.target,
        amount_usd: +d.amount_usd,
        transaction_type: d.transaction_type,
        transaction_count: +d.transaction_count
    }))
])
    .then(([companies, transactions]) => {
        drawNetwork(companies, transactions);
    })
    .catch(error => {
        d3.select("#network-status").text("Could not load network data");
        d3.select("#assignment-chart")
            .append("p")
            .attr("class", "chart-error")
            .text(error.message);
    });
