const TOPIC_COLORS = {
    "Quantitative and Physical Sciences": "#4e79a7",
    "Policy, Health, and Society": "#59a14f",
    "Credit and Degree Requirements": "#e8582a",
    "Academic Calendar and Deadlines": "#edc948",
    "Global History, Culture, and Politics": "#b07aa1",
    "Academic Standing and Withdrawal": "#f28e2b",
    "Language, Media, and Skills": "#76b7b2",
    "University Identity and Study Away": "#3b6755"
};

const tooltip = d3.select("body").append("div").attr("class", "tooltip");

function showTooltip(event, html) {
    tooltip.style("opacity", 1).html(html)
        .style("left", `${event.pageX + 14}px`)
        .style("top", `${event.pageY + 14}px`);
}

function hideTooltip() {
    tooltip.style("opacity", 0);
}

function partNumber(chapter) {
    const match = String(chapter).match(/Part\s+(\d+)/);
    return match ? Number(match[1]) : 99;
}

function partLabel(chapter) {
    const match = String(chapter).match(/^Part\s+(\d+):\s+(.+)$/);
    if (!match) return chapter;
    const name = match[2].length > 46 ? `${match[2].slice(0, 44)}…` : match[2];
    return `Part ${match[1]} · ${name}`;
}

function horizontalBars(selector, rows, labelOf, valueOf, format = d3.format(",")) {
    const rowHeight = 26;
    const margin = { top: 8, right: 52, bottom: 8, left: 360 };
    const width = 980;
    const height = margin.top + margin.bottom + rows.length * rowHeight;
    const svg = d3.select(selector).append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "presentation");
    const x = d3.scaleLinear()
        .domain([0, d3.max(rows, valueOf)])
        .range([margin.left, width - margin.right]);

    svg.selectAll("rect")
        .data(rows)
        .join("rect")
        .attr("class", "bar")
        .attr("x", margin.left)
        .attr("y", (_, i) => margin.top + i * rowHeight + 4)
        .attr("width", d => Math.max(0, x(valueOf(d)) - margin.left))
        .attr("height", rowHeight - 8)
        .on("mousemove", (event, d) => {
            showTooltip(event, `<strong>${labelOf(d)}</strong><br>${format(valueOf(d))}`);
        })
        .on("mouseleave", hideTooltip);

    svg.selectAll(".bar-name")
        .data(rows)
        .join("text")
        .attr("class", "bar-name")
        .attr("x", margin.left - 10)
        .attr("y", (_, i) => margin.top + i * rowHeight + 16)
        .attr("text-anchor", "end")
        .text(labelOf);

    svg.selectAll(".bar-score")
        .data(rows)
        .join("text")
        .attr("class", "bar-score")
        .attr("x", d => x(valueOf(d)) + 6)
        .attr("y", (_, i) => margin.top + i * rowHeight + 17)
        .text(d => format(valueOf(d)));
}

function drawOverview(passages, tfidf, terms) {
    horizontalBars(
        "#top-terms-chart",
        terms,
        d => d.term,
        d => d.count
    );

    const lengthBySection = d3.rollups(
        passages,
        v => ({ avg: d3.mean(v, d => d.word_count), n: v.length }),
        d => d.section
    )
        .map(([section, stats]) => ({ section, avg: stats.avg, n: stats.n }))
        .filter(d => d.n >= 8)
        .sort((a, b) => b.avg - a.avg);
    horizontalBars(
        "#length-by-section",
        lengthBySection,
        d => (d.section.length > 52 ? `${d.section.slice(0, 50)}…` : d.section),
        d => d.avg,
        d3.format(".0f")
    );

    horizontalBars(
        "#tfidf-chart",
        tfidf,
        d => d.term,
        d => d.mean_tfidf
    );
    d3.select("#tfidf-chart").selectAll(".bar-score")
        .text(d => d.mean_tfidf.toFixed(3));
}

Promise.all([
    d3.csv("../data/lab8_embedding_map.csv", d => ({
        ...d,
        x: +d.x,
        y: +d.y,
        word_count: +d.word_count,
        cluster: +d.cluster,
        page: +d.page
    })),
    d3.csv("../data/lab8_topic_section_matrix.csv", d => ({
        ...d,
        count: +d.count,
        proportion: +d.proportion
    })),
    d3.csv("../data/lab8_top_tfidf.csv", d => ({
        ...d,
        mean_tfidf: +d.mean_tfidf
    })),
    d3.csv("../data/lab8_top_terms.csv", d => ({
        ...d,
        count: +d.count
    }))
]).then(([passages, matrixRows, tfidf, terms]) => {
    drawOverview(passages, tfidf, terms);
    drawExplorer(passages, matrixRows);
}).catch(error => {
    d3.select("#semantic-map")
        .append("p")
        .attr("class", "chart-error")
        .text(`The bulletin data could not be loaded. ${error.message}`);
});

function drawExplorer(passages, matrixRows) {
    const byId = new Map(passages.map(d => [d.passage_id, d]));
    const topics = Array.from(d3.rollup(passages, v => v.length, d => d.cluster_name))
        .sort((a, b) => b[1] - a[1])
        .map(d => d[0]);

    const chapters = d3.groups(passages, d => d.chapter)
        .sort((a, b) => partNumber(a[0]) - partNumber(b[0]));

    const sectionFilter = d3.select("#section-filter");
    sectionFilter.append("option").attr("value", "All").text("All sections");
    chapters.forEach(([chapter, rows]) => {
        const group = sectionFilter.append("optgroup").attr("label", chapter);
        const names = Array.from(new Set(rows.map(d => d.section))).sort();
        names.forEach(name => {
            group.append("option").attr("value", name).text(name);
        });
    });

    const topicFilter = d3.select("#topic-filter");
    topicFilter.append("option").attr("value", "All").text("All topics");
    topics.forEach(topic => {
        topicFilter.append("option").attr("value", topic).text(topic);
    });

    const legend = d3.select("#topic-legend");
    topics.forEach(topic => {
        legend.append("span")
            .html(`<i class="status-swatch" style="background:${TOPIC_COLORS[topic]}"></i>`)
            .append("span")
            .text(topic);
    });
    legend.append("span").text("Larger point = longer passage");

    const width = 860;
    const height = 640;
    const svg = d3.select("#semantic-map").append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "presentation");
    svg.append("rect")
        .attr("class", "map-bg")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "#f4f1e9");

    const xScale = d3.scaleLinear()
        .domain(d3.extent(passages, d => d.x))
        .range([36, width - 24]);
    const yScale = d3.scaleLinear()
        .domain(d3.extent(passages, d => d.y))
        .range([height - 28, 28]);
    const rScale = d3.scaleSqrt()
        .domain(d3.extent(passages, d => d.word_count))
        .range([3.2, 12]);

    const layer = svg.append("g").attr("class", "zoom-layer");
    const points = layer.selectAll(".passage")
        .data(passages)
        .join("circle")
        .attr("class", "passage")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", d => rScale(d.word_count))
        .attr("fill", d => TOPIC_COLORS[d.cluster_name] || "#17211d");

    const zoom = d3.zoom()
        .scaleExtent([0.7, 10])
        .on("zoom", event => layer.attr("transform", event.transform));
    svg.call(zoom);

    let searchQuery = "";
    let activeSection = "All";
    let activeTopic = "All";
    let selected = null;
    let matrixFocus = null;
    let neighborIds = new Set();

    function neighborsOf(passage) {
        return String(passage.neighbor_ids).split("|").filter(id => byId.has(id));
    }

    function matchesFilters(d) {
        if (activeSection !== "All" && d.section !== activeSection) return false;
        if (activeTopic !== "All" && d.cluster_name !== activeTopic) return false;
        if (searchQuery && !d.text.toLowerCase().includes(searchQuery)) return false;
        if (matrixFocus && (d.section !== matrixFocus.section || d.cluster_name !== matrixFocus.topic)) {
            return false;
        }
        return true;
    }

    function isEmphasized(d) {
        return selected && (d.passage_id === selected.passage_id || neighborIds.has(d.passage_id));
    }

    function updateMap() {
        points
            .attr("opacity", d => (isEmphasized(d) || matchesFilters(d) ? 0.92 : 0.07))
            .attr("stroke", d => {
                if (selected && d.passage_id === selected.passage_id) return "#17211d";
                if (neighborIds.has(d.passage_id)) return "#e8582a";
                return "rgba(23,33,29,0.28)";
            })
            .attr("stroke-width", d => {
                if (selected && d.passage_id === selected.passage_id) return 2.4;
                if (neighborIds.has(d.passage_id)) return 1.8;
                return 0.35;
            });
        if (selected) {
            points.filter(d => d.passage_id === selected.passage_id || neighborIds.has(d.passage_id)).raise();
        }

        const visible = passages.filter(d => isEmphasized(d) || matchesFilters(d)).length;
        let status = `${visible.toLocaleString()} of ${passages.length.toLocaleString()} passages`;
        if (matrixFocus) {
            status = `${visible.toLocaleString()} · ${matrixFocus.section} × ${matrixFocus.topic}`;
        }
        d3.select("#map-status").text(status);
        updateMatrix();
    }

    function showPassage(passage) {
        selected = passage;
        matrixFocus = null;
        neighborIds = new Set(neighborsOf(passage));
        const panel = d3.select("#detail-panel");
        panel.selectAll("*").remove();
        panel.append("h3").text(passage.section);
        const meta = panel.append("dl").attr("class", "detail-meta");
        [
            ["Chapter", passage.chapter],
            ["Section", passage.section],
            ["Subsection", passage.subsection || "—"],
            ["Page", passage.page],
            ["Semantic topic", passage.cluster_name],
            ["Length", `${passage.word_count} words`]
        ].forEach(([label, value]) => {
            const row = meta.append("div");
            row.append("dt").text(label);
            row.append("dd").text(value);
        });
        panel.append("p").text(passage.text);

        panel.append("p").append("strong").text("Five nearest passages");
        const scores = String(passage.neighbor_scores).split("|");
        const list = panel.append("ol").attr("class", "neighbor-list");
        neighborsOf(passage).forEach((id, index) => {
            const neighbor = byId.get(id);
            const item = list.append("li");
            const head = item.append("div");
            head.append("strong").text(neighbor.section);
            head.append("span").text(` · p. ${neighbor.page} · ${neighbor.cluster_name} · similarity ${scores[index]}`);
            item.append("p").text(neighbor.text);
            item.append("button")
                .attr("type", "button")
                .text("Show this passage")
                .on("click", () => {
                    showPassage(neighbor);
                    updateMap();
                });
        });
        updateMap();
    }

    points
        .on("click", (event, d) => {
            event.stopPropagation();
            showPassage(d);
        })
        .on("mousemove", (event, d) => {
            showTooltip(
                event,
                `<strong>${d.cluster_name}</strong><br>${d.section}<br>Page ${d.page} · ${d.word_count} words<br>${d.text.slice(0, 160)}…`
            );
        })
        .on("mouseleave", hideTooltip);

    svg.on("click", event => {
        if (event.defaultPrevented) return;
        if (event.target !== svg.select(".map-bg").node() && event.target !== svg.node()) return;
        selected = null;
        matrixFocus = null;
        neighborIds = new Set();
        d3.select("#detail-panel").html("<h3>Passage details</h3><p>Click a point, or a cell in the matrix, to read a passage in place.</p>");
        updateMap();
    });

    d3.select("#search").on("input", function onSearch() {
        searchQuery = this.value.toLowerCase().trim();
        matrixFocus = null;
        updateMap();
    });
    sectionFilter.on("change", function onSection() {
        activeSection = this.value;
        matrixFocus = null;
        updateMap();
    });
    topicFilter.on("change", function onTopic() {
        activeTopic = this.value;
        matrixFocus = null;
        updateMap();
    });
    d3.select("#reset-view").on("click", () => {
        searchQuery = "";
        activeSection = "All";
        activeTopic = "All";
        selected = null;
        matrixFocus = null;
        neighborIds = new Set();
        d3.select("#search").property("value", "");
        sectionFilter.property("value", "All");
        topicFilter.property("value", "All");
        d3.select("#detail-panel").html("<h3>Passage details</h3><p>Click a point, or a cell in the matrix, to read a passage in place.</p>");
        svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity);
        updateMap();
    });

    const sections = chapters.flatMap(([chapter, rows]) => {
        const names = Array.from(d3.rollup(rows, v => v.length, d => d.section), ([section, count]) => ({
            chapter,
            section,
            count
        }));
        return names.sort((a, b) => b.count - a.count);
    });
    const lookup = new Map(matrixRows.map(d => [`${d.section}||${d.cluster_name}`, d]));
    const maxCount = d3.max(matrixRows, d => d.count);
    const cellColor = d3.scaleSqrt().domain([0, maxCount]).range(["#f7f4ee", "#e8582a"]);

    const rowHeight = 18;
    const colWidth = 58;
    const matrixMargin = { top: 168, right: 16, bottom: 16, left: 292 };
    const matrixWidth = matrixMargin.left + topics.length * colWidth + matrixMargin.right;
    const matrixHeight = matrixMargin.top + sections.length * rowHeight + matrixMargin.bottom;
    const matrixSvg = d3.select("#topic-matrix").append("svg")
        .attr("viewBox", `0 0 ${matrixWidth} ${matrixHeight}`)
        .attr("role", "presentation");

    topics.forEach((topic, index) => {
        matrixSvg.append("text")
            .attr("transform", `translate(${matrixMargin.left + index * colWidth + colWidth / 2}, ${matrixMargin.top - 8}) rotate(-55)`)
            .attr("text-anchor", "start")
            .attr("fill", "#17211d")
            .attr("font-size", 11)
            .attr("font-family", "DM Sans, Arial, sans-serif")
            .text(topic);
    });

    const cells = matrixSvg.selectAll(".matrix-cell")
        .data(sections.flatMap((section, row) => topics.map((topic, col) => {
            const found = lookup.get(`${section.section}||${topic}`);
            return {
                chapter: section.chapter,
                section: section.section,
                topic,
                count: found ? found.count : 0,
                proportion: found ? found.proportion : 0,
                row,
                col
            };
        })))
        .join("rect")
        .attr("class", "matrix-cell")
        .attr("x", d => matrixMargin.left + d.col * colWidth + 2)
        .attr("y", d => matrixMargin.top + d.row * rowHeight + 2)
        .attr("width", colWidth - 4)
        .attr("height", rowHeight - 3)
        .attr("fill", d => cellColor(d.count))
        .attr("stroke", "#e4ddcf")
        .on("mousemove", (event, d) => {
            const share = d3.format(".0%")(d.proportion);
            showTooltip(
                event,
                `<strong>${d.section}</strong><br>${d.topic}<br>${d.count} passage${d.count === 1 ? "" : "s"} · ${share} of this section`
            );
        })
        .on("mouseleave", hideTooltip)
        .on("click", (event, d) => {
            if (!d.count) return;
            selected = null;
            neighborIds = new Set();
            matrixFocus = d;
            const panel = d3.select("#detail-panel");
            panel.selectAll("*").remove();
            panel.append("h3").text(d.section);
            panel.append("p").text(
                `${d.count} passages in “${d.topic}”, ${d3.format(".0%")(d.proportion)} of this formal section. Those passages are highlighted on the map.`
            );
            updateMap();
        });

    matrixSvg.selectAll(".matrix-label")
        .data(sections)
        .join("text")
        .attr("class", "matrix-label")
        .attr("x", matrixMargin.left - 8)
        .attr("y", (_, i) => matrixMargin.top + i * rowHeight + 13)
        .attr("text-anchor", "end")
        .attr("fill", "#33413b")
        .attr("font-size", 10)
        .attr("font-family", "DM Sans, Arial, sans-serif")
        .text(d => (d.section.length > 42 ? `${d.section.slice(0, 40)}…` : d.section));

    function updateMatrix() {
        cells.attr("stroke", d => {
            const fromPoint = selected && selected.section === d.section && selected.cluster_name === d.topic;
            const fromCell = matrixFocus && matrixFocus.section === d.section && matrixFocus.topic === d.topic;
            return fromPoint || fromCell ? "#17211d" : "#e4ddcf";
        }).attr("stroke-width", d => {
            const fromPoint = selected && selected.section === d.section && selected.cluster_name === d.topic;
            const fromCell = matrixFocus && matrixFocus.section === d.section && matrixFocus.topic === d.topic;
            return fromPoint || fromCell ? 2 : 0.5;
        });
    }

    updateMap();
}
