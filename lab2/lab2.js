const width = 800;
const height = 500;

const margin = {
    top: 50,
    right: 260,
    bottom: 70,
    left: 120
};

const tooltip = d3.select("#tooltip");

d3.csv("../data/students_multivariate.csv", d => ({
    name: d.name,
    study_hours: +d.study_hours,
    score: +d.score,
    major: d.major,
    year: d.year
}))
    .then(data => {
        console.log(data);

        const svg = d3.select("#chart")
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        const xScale = d3.scaleLinear()
            .domain(d3.extent(data, d => d.study_hours))
            .nice()
            .range([
                margin.left,
                width - margin.right
            ]);

        const yScale = d3.scaleLinear()
            .domain(d3.extent(data, d => d.score))
            .nice()
            .range([
                height - margin.bottom,
                margin.top
            ]);

        const majors = Array.from(
            new Set(data.map(d => d.major))
        );

        const colorScale = d3.scaleOrdinal()
            .domain(majors)
            .range(d3.schemeTableau10);

        const sizeScale = d3.scaleOrdinal()
            .domain([
                "Freshman",
                "Sophomore",
                "Junior",
                "Senior"
            ])
            .range([5, 7, 9, 11]);

        svg.append("g")
            .attr(
                "transform",
                `translate(0, ${height - margin.bottom})`
            )
            .call(d3.axisBottom(xScale));

        svg.append("g")
            .attr(
                "transform",
                `translate(${margin.left}, 0)`
            )
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
            .attr(
                "cx",
                d => xScale(d.study_hours)
            )
            .attr(
                "cy",
                d => yScale(d.score)
            )
            .attr(
                "r",
                d => sizeScale(d.year)
            )
            .attr(
                "fill",
                d => colorScale(d.major)
            )
            .attr("opacity", 0.8)
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
            .attr(
                "transform",
                `translate(${width - margin.right + 25}, 60)`
            );

        legend.append("text")
            .attr("x", 0)
            .attr("y", -14)
            .text("Major");

        const legendItems = legend
            .selectAll(".legend-item")
            .data(majors)
            .join("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * 24})`);

        legendItems.append("circle")
            .attr("r", 6)
            .attr("cx", 6)
            .attr("cy", 0)
            .attr("fill", d => colorScale(d));

        legendItems.append("text")
            .attr("x", 18)
            .attr("y", 4)
            .text(d => d);
    })
    .catch(error => {
        d3.select("#chart")
            .append("p")
            .attr("class", "chart-error")
            .text(`Failed to load student data: ${error.message}`);
    });

d3.csv("../data/cities_multivariate.csv", d => ({
    city: d.city,
    population: +d.population,
    temp_c: +d.temp_c,
    development_level: d.development_level,
    region: d.region
}))
    .then(data => {
        const assignWidth = 900;
        const assignHeight = 560;
        const assignMargin = {
            top: 50,
            right: 260,
            bottom: 70,
            left: 120
        };

        const svg = d3.select("#assignment-chart")
            .append("svg")
            .attr("width", assignWidth)
            .attr("height", assignHeight);

        const regions = Array.from(new Set(data.map(d => d.region)));
        const devLevels = ["Low", "Medium", "High"];

        const xScale = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.population)])
            .nice()
            .range([assignMargin.left, assignWidth - assignMargin.right]);

        const yScale = d3.scaleBand()
            .domain(data.map(d => d.city))
            .range([assignMargin.top, assignHeight - assignMargin.bottom])
            .padding(0.35);

        const colorScale = d3.scaleOrdinal()
            .domain(regions)
            .range(d3.schemeTableau10);

        const tempScale = d3.scaleSqrt()
            .domain(d3.extent(data, d => d.temp_c))
            .range([6, 18]);

        const levelWidthScale = d3.scaleOrdinal()
            .domain(devLevels)
            .range([1.5, 2.5, 3.5]);

        const levelOpacityScale = d3.scaleOrdinal()
            .domain(devLevels)
            .range([0.5, 0.75, 0.95]);

        svg.append("g")
            .attr("transform", `translate(0, ${assignHeight - assignMargin.bottom})`)
            .call(d3.axisBottom(xScale));

        svg.append("g")
            .attr("transform", `translate(${assignMargin.left}, 0)`)
            .call(d3.axisLeft(yScale));

        svg.append("text")
            .attr("x", (assignMargin.left + assignWidth - assignMargin.right) / 2)
            .attr("y", assignHeight - 20)
            .attr("text-anchor", "middle")
            .text("Population (millions)");

        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -(assignMargin.top + assignHeight - assignMargin.bottom) / 2)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .text("City");

        const rows = svg.selectAll(".city-row")
            .data(data)
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
            .attr("x1", xScale(0))
            .attr("x2", d => xScale(d.population))
            .attr("y1", d => yScale(d.city) + yScale.bandwidth() / 2)
            .attr("y2", d => yScale(d.city) + yScale.bandwidth() / 2)
            .attr("stroke", d => colorScale(d.region))
            .attr("stroke-width", d => levelWidthScale(d.development_level))
            .attr("opacity", d => levelOpacityScale(d.development_level));

        rows.append("circle")
            .attr("cx", d => xScale(d.population))
            .attr("cy", d => yScale(d.city) + yScale.bandwidth() / 2)
            .attr("r", d => tempScale(d.temp_c))
            .attr("fill", d => colorScale(d.region))
            .attr("stroke", "#17211d")
            .attr("stroke-width", d => levelWidthScale(d.development_level))
            .attr("opacity", d => levelOpacityScale(d.development_level));

        const legendX = assignWidth - assignMargin.right + 25;

        const regionLegend = svg.append("g")
            .attr("transform", `translate(${legendX}, 70)`);

        regionLegend.append("text")
            .attr("x", 0)
            .attr("y", -14)
            .text("Region (color)");

        const regionItems = regionLegend.selectAll(".region-item")
            .data(regions)
            .join("g")
            .attr("transform", (d, i) => `translate(0, ${i * 24})`);

        regionItems.append("circle")
            .attr("r", 6)
            .attr("cx", 6)
            .attr("cy", 0)
            .attr("fill", d => colorScale(d));

        regionItems.append("text")
            .attr("x", 18)
            .attr("y", 4)
            .text(d => d);

        const levelLegend = svg.append("g")
            .attr("transform", `translate(${legendX}, 205)`);

        levelLegend.append("text")
            .attr("x", 0)
            .attr("y", -14)
            .text("Development (stroke)");

        const levelItems = levelLegend.selectAll(".level-item")
            .data(devLevels)
            .join("g")
            .attr("transform", (d, i) => `translate(0, ${i * 26})`);

        levelItems.append("circle")
            .attr("r", 7)
            .attr("cx", 7)
            .attr("cy", 0)
            .attr("fill", "#ffffff")
            .attr("stroke", "#17211d")
            .attr("stroke-width", d => levelWidthScale(d))
            .attr("opacity", d => levelOpacityScale(d));

        levelItems.append("text")
            .attr("x", 22)
            .attr("y", 4)
            .text(d => d);

        const tempLegend = svg.append("g")
            .attr("transform", `translate(${legendX}, 340)`);

        tempLegend.append("text")
            .attr("x", 0)
            .attr("y", -14)
            .text("Temp (size)");

        const tempValues = d3.extent(data, d => d.temp_c);
        const tempMid = (tempValues[0] + tempValues[1]) / 2;
        const tempLegendValues = [tempValues[0], tempMid, tempValues[1]];

        const tempItems = tempLegend.selectAll(".temp-item")
            .data(tempLegendValues)
            .join("g")
            .attr("transform", (d, i) => `translate(0, ${i * 36})`);

        tempItems.append("circle")
            .attr("r", d => tempScale(d))
            .attr("cx", 10)
            .attr("cy", 0)
            .attr("fill", "#cccccc")
            .attr("stroke", "#17211d");

        tempItems.append("text")
            .attr("x", 30)
            .attr("y", 4)
            .text(d => `${d.toFixed(1)}°C`);
    })
    .catch(error => {
        d3.select("#assignment-chart")
            .append("p")
            .attr("class", "chart-error")
            .text(`Failed to load city data: ${error.message}`);
    });
