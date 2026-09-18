const tooltip = d3.select("#tooltip");
const dateFormat = d3.timeFormat("%Y-%m-%d");
const moneyFormat = d3.format("$,.0f");

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
