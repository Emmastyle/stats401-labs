const tooltip = d3.select("#tooltip");
const sentimentColors = {
    Negative: "#e8582a",
    Neutral: "#8a8174",
    Positive: "#3b6755"
};
const launchDate = new Date("2024-02-02T00:00:00");

function likesRadius(likes, sizeScale) {
    return sizeScale(Math.max(0, likes));
}

async function drawChart() {
    const width = 1040;
    const height = 560;
    const margin = { top: 28, right: 210, bottom: 70, left: 70 };

    const data = await d3.csv("../data/lab4_clean_tweets.csv", d => ({
        ...d,
        likes: +d.likes,
        retweets: +d.retweets,
        sentiment_score: +d.sentiment_score,
        sentiment_confidence: +d.sentiment_confidence,
        created_at: new Date(d.created_at)
    }));

    console.log(data);

    const status = d3.select("#chart-status");
    status.text(`${data.length.toLocaleString()} tweets`);

    const svg = d3.select("#chart")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "img")
        .attr("aria-labelledby", "svg-title svg-desc");

    svg.append("title")
        .attr("id", "svg-title")
        .text("Tweet sentiment over time");

    svg.append("desc")
        .attr("id", "svg-desc")
        .text("Each point is a tweet. Date is on the x-axis, sentiment score on the y-axis, sentiment class in color, and likes in point size.");

    const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.created_at))
        .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
        .domain([-1, 1])
        .range([height - margin.bottom, margin.top]);

    const sizeScale = d3.scaleSqrt()
        .domain([0, d3.max(data, d => d.likes)])
        .range([3.5, 18]);

    const xGrid = d3.axisBottom(x)
        .ticks(7)
        .tickSize(-(height - margin.top - margin.bottom))
        .tickFormat("");

    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(xGrid)
        .selectAll("line")
        .attr("stroke", "rgba(23, 33, 29, 0.12)");

    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(7));

    svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(y).ticks(8));

    svg.append("text")
        .attr("x", (margin.left + width - margin.right) / 2)
        .attr("y", height - 22)
        .attr("text-anchor", "middle")
        .style("font-size", "13px")
        .text("Tweet date");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 22)
        .attr("text-anchor", "middle")
        .style("font-size", "13px")
        .text("Sentiment score  (positive − negative)");

    svg.append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", y(0))
        .attr("y2", y(0))
        .attr("stroke", "rgba(23, 33, 29, 0.45)")
        .attr("stroke-dasharray", "4,4");

    svg.append("line")
        .attr("class", "launch-line")
        .attr("x1", x(launchDate))
        .attr("x2", x(launchDate))
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom)
        .attr("stroke", "#17211d")
        .attr("stroke-dasharray", "2,3")
        .attr("opacity", 0.55);

    svg.append("text")
        .attr("x", x(launchDate) + 8)
        .attr("y", margin.top + 14)
        .style("font-size", "11px")
        .style("letter-spacing", "0.06em")
        .style("text-transform", "uppercase")
        .attr("fill", "#65706b")
        .text("U.S. launch");

    const points = svg.append("g")
        .selectAll("circle")
        .data(data.slice().sort((a, b) => d3.ascending(a.likes, b.likes)))
        .join("circle")
        .attr("class", "tweet-point")
        .attr("cx", d => x(d.created_at))
        .attr("cy", d => y(d.sentiment_score))
        .attr("r", d => likesRadius(d.likes, sizeScale))
        .attr("fill", d => sentimentColors[d.sentiment] || "#8a8174")
        .attr("fill-opacity", 0.72)
        .attr("stroke", "none")
        .on("mouseover", function (event, d) {
            points.attr("fill-opacity", 0.18);
            d3.select(this)
                .attr("fill-opacity", 1)
                .attr("stroke", "#17211d")
                .attr("stroke-width", 1.5)
                .raise();

            const snippet = d.tweet_text_raw.length > 180
                ? `${d.tweet_text_raw.slice(0, 180)}…`
                : d.tweet_text_raw;

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.sentiment}</strong> · score ${d.sentiment_score.toFixed(2)}<br>
                    Likes: ${d.likes.toLocaleString()} · Retweets: ${d.retweets.toLocaleString()}<br>
                    ${d3.timeFormat("%b %d, %Y")(d.created_at)} · @${d.username}<br>
                    ${snippet}
                `);
        })
        .on("mousemove", function (event) {
            tooltip
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", function () {
            points.attr("fill-opacity", 0.72);
            d3.select(this).attr("stroke", "none");
            tooltip.style("opacity", 0);
        });

    const legend = svg.append("g")
        .attr("transform", `translate(${width - margin.right + 28}, ${margin.top + 8})`);

    legend.append("text")
        .style("font-size", "13px")
        .style("font-weight", "600")
        .text("Sentiment");

    const classes = ["Negative", "Neutral", "Positive"];
    const classItems = legend.selectAll(".sentiment-item")
        .data(classes)
        .join("g")
        .attr("transform", (d, i) => `translate(0, ${28 + i * 24})`);

    classItems.append("circle")
        .attr("r", 6)
        .attr("cx", 6)
        .attr("fill", d => sentimentColors[d]);

    classItems.append("text")
        .attr("x", 18)
        .attr("y", 4)
        .style("font-size", "12px")
        .text(d => d);

    legend.append("text")
        .attr("y", 128)
        .style("font-size", "13px")
        .style("font-weight", "600")
        .text("Likes");

    const likeTicks = [
        0,
        Math.round(d3.quantile(data.map(d => d.likes).sort(d3.ascending), 0.75)),
        d3.max(data, d => d.likes)
    ];
    const uniqueTicks = Array.from(new Set(likeTicks.filter(value => Number.isFinite(value))));
    const likeItems = legend.selectAll(".like-item")
        .data(uniqueTicks)
        .join("g")
        .attr("transform", (d, i) => `translate(0, ${156 + i * 30})`);

    likeItems.append("circle")
        .attr("cx", 10)
        .attr("r", d => likesRadius(d, sizeScale))
        .attr("fill", "none")
        .attr("stroke", "#17211d");

    likeItems.append("text")
        .attr("x", 28)
        .attr("y", 4)
        .style("font-size", "12px")
        .text(d => d.toLocaleString());
}

drawChart().catch(error => {
    d3.select("#chart-status").text("Data unavailable");
    d3.select("#chart")
        .append("p")
        .attr("class", "chart-error")
        .text(`The chart data could not be loaded: ${error.message}`);
});
