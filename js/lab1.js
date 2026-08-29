async function drawChart() {
  const chart = d3.select("#chart");

  try {
    const data = await d3.csv("../data/students.csv", d => ({
      name: d.name,
      score: +d.score
    }));

    const width = 1040;
    const height = 440;
    const margin = { top: 28, right: 24, bottom: 106, left: 24 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const x = d3.scaleBand()
      .domain(data.map(d => d.name))
      .range([0, innerWidth])
      .padding(0.28);

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([innerHeight, 0]);

    const svg = chart.append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("aria-labelledby", "svg-title svg-desc");

    svg.append("title").attr("id", "svg-title").text("Student Scores");
    svg.append("desc").attr("id", "svg-desc").text(data.map(d => `${d.name}: ${d.score}`).join(", "));

    const plot = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    plot.append("line")
      .attr("class", "baseline")
      .attr("x1", 0).attr("x2", innerWidth)
      .attr("y1", innerHeight).attr("y2", innerHeight);

    plot.selectAll("rect.bar")
      .data(data)
      .join("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.name))
      .attr("y", d => y(d.score))
      .attr("width", x.bandwidth())
      .attr("height", d => innerHeight - y(d.score))
      .append("title")
      .text(d => `${d.name}: ${d.score}`);

    plot.selectAll("text.bar-score")
      .data(data)
      .join("text")
      .attr("class", "bar-score")
      .attr("x", d => x(d.name) + x.bandwidth() / 2)
      .attr("y", innerHeight + 28)
      .attr("text-anchor", "middle")
      .text(d => d.score);

    plot.selectAll("text.bar-name")
      .data(data)
      .join("text")
      .attr("class", "bar-name")
      .attr("x", d => x(d.name) + x.bandwidth() / 2)
      .attr("y", innerHeight + 50)
      .attr("text-anchor", "middle")
      .text(d => d.name);
  } catch (error) {
    console.error("Unable to load student scores:", error);
    chart.append("p")
      .attr("class", "chart-error")
      .text("The chart data could not be loaded. Please view this page through a local web server.");
  }
}

drawChart();
