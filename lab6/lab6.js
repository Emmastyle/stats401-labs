const tooltip = d3.select("#tooltip");

const statusScale = d3.scaleOrdinal()
    .domain(["Increase", "Unchanged", "Decrease"])
    .range(d3.schemeTableau10);

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

function formatNumber(value) {
    return value.toLocaleString("en-US");
}

function statusLabelFill(status) {
    return status === "Unchanged" ? "#17211d" : "#f4f1e9";
}

function drawGdpTreemap(selector, data, tile, controls) {
    const width = 900;
    const height = 550;

    const root = d3.hierarchy(data)
        .sum(d => d.gdp || 0)
        .sort((a, b) => b.value - a.value);

    d3.treemap()
        .tile(tile)
        .size([width, height])
        .paddingInner(3)
        .paddingOuter(4)
        .paddingTop(22)(root);

    const x = d3.scaleLinear()
        .domain([root.x0, root.x1])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([root.y0, root.y1])
        .range([0, height]);

    let focus = root;

    const svg = d3.select(selector)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", width)
        .attr("height", height)
        .attr("role", "img")
        .attr("aria-label", "Zoomable GDP treemap of countries nested by continent and area");

    const continentLabels = svg.selectAll(".continent-label")
        .data(root.descendants().filter(d => d.depth === 1))
        .join("text")
        .attr("class", "continent-label")
        .attr("x", d => x(d.x0) + 6)
        .attr("y", d => y(d.y0) + 15)
        .text(d => d.data.name);

    const areaOutlines = svg.selectAll(".area-outline")
        .data(root.descendants().filter(d => d.depth === 2))
        .join("rect")
        .attr("class", "area-outline")
        .attr("x", d => x(d.x0))
        .attr("y", d => y(d.y0))
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0)))
        .attr("height", d => Math.max(0, y(d.y1) - y(d.y0)))
        .attr("fill", "none")
        .attr("stroke", "rgba(23, 33, 29, 0.28)")
        .attr("pointer-events", "none");

    const cells = svg.selectAll(".cell")
        .data(root.leaves())
        .join("g")
        .attr("class", "cell")
        .attr("transform", d => `translate(${x(d.x0)},${y(d.y0)})`);

    cells.append("rect")
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0)))
        .attr("height", d => Math.max(0, y(d.y1) - y(d.y0)))
        .attr("fill", d => statusScale(d.data.status));

    cells.append("text")
        .attr("x", 5)
        .attr("y", 16)
        .attr("fill", d => statusLabelFill(d.data.status))
        .attr("font-size", 11)
        .style("pointer-events", "none")
        .text(d => d.data.name);

    function labelFits(node) {
        const w = x(node.x1) - x(node.x0);
        const h = y(node.y1) - y(node.y0);
        return w > 44 && h > 20;
    }

    function setFocus(node) {
        focus = node;
        d3.select(controls.focusId).text(
            `Viewing: ${focus.ancestors().map(d => d.data.name).reverse().join(" → ")}`
        );
        d3.select(controls.zoomOutId).attr(
            "disabled",
            focus === root ? true : null
        );
    }

    function zoomTo(d) {
        x.domain([d.x0, d.x1]);
        y.domain([d.y0, d.y1]);

        cells.transition()
            .duration(600)
            .attr("transform", node => `translate(${x(node.x0)},${y(node.y0)})`);

        cells.select("rect")
            .transition()
            .duration(600)
            .attr("width", node => Math.max(0, x(node.x1) - x(node.x0)))
            .attr("height", node => Math.max(0, y(node.y1) - y(node.y0)));

        cells.select("text")
            .transition()
            .duration(600)
            .attr("opacity", node => {
                const w = x(node.x1) - x(node.x0);
                const h = y(node.y1) - y(node.y0);
                if (w < 44 || h < 20) {
                    return 0;
                }
                return 1;
            });

        continentLabels.transition()
            .duration(600)
            .attr("x", node => x(node.x0) + 6)
            .attr("y", node => y(node.y0) + 15)
            .attr("opacity", node => (x(node.x1) - x(node.x0) > 70 ? 1 : 0));

        areaOutlines.transition()
            .duration(600)
            .attr("x", node => x(node.x0))
            .attr("y", node => y(node.y0))
            .attr("width", node => Math.max(0, x(node.x1) - x(node.x0)))
            .attr("height", node => Math.max(0, y(node.y1) - y(node.y0)));
    }

    function zoomInToward(leaf) {
        if (focus === leaf.parent) {
            return;
        }

        let next = leaf;
        while (next.parent && next.parent !== focus) {
            next = next.parent;
        }

        if (next.parent === focus) {
            setFocus(next);
            zoomTo(focus);
        }
    }

    function zoomOut() {
        if (focus.parent) {
            setFocus(focus.parent);
            zoomTo(focus);
        }
    }

    cells
        .on("mouseover", function(event, d) {
            showTooltip(event, `
                <strong>${d.data.name}</strong>
                <br>
                Continent: ${d.parent.parent.data.name}
                <br>
                Area: ${d.parent.data.name}
                <br>
                GDP: ${formatNumber(d.value)} billion USD
                <br>
                GDP status: ${d.data.status}
            `);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip)
        .on("click", function(event, d) {
            zoomInToward(d);
        });

    d3.select(controls.zoomOutId).on("click", zoomOut);

    cells.select("text")
        .attr("opacity", d => labelFits(d) ? 1 : 0);

    continentLabels.attr("opacity", d => (x(d.x1) - x(d.x0) > 70 ? 1 : 0));

    setFocus(root);
}

d3.json("../data/lab6_assignment_gdp.json")
    .then(data => {
        drawGdpTreemap("#gdp-squarify", data, d3.treemapSquarify, {
            focusId: "#squarify-focus",
            zoomOutId: "#squarify-zoom-out"
        });
        drawGdpTreemap("#gdp-slicedice", data, d3.treemapSliceDice, {
            focusId: "#slicedice-focus",
            zoomOutId: "#slicedice-zoom-out"
        });
        d3.select("#gdp-status").text("27 countries · 6 continents");
    })
    .catch(error => {
        console.error(error);
        d3.select("#gdp-squarify").html(
            `<p class="chart-error">Could not load lab6_assignment_gdp.json. Serve the repository over HTTP so D3 can read the file.</p>`
        );
    });
