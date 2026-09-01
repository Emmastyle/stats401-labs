const numericColumns = new Set(["price_gbp", "source_page"]);
const columnLabels = {
    title: "Title",
    price_gbp: "Price (GBP)",
    star_rating: "Star Rating",
    availability: "Availability",
    source_page: "Source Page"
};

function compareValues(left, right, column, ascending) {
    const direction = ascending ? d3.ascending : d3.descending;

    if (numericColumns.has(column)) {
        return direction(+left[column], +right[column]);
    }

    return direction(
        left[column].toLocaleLowerCase(),
        right[column].toLocaleLowerCase()
    );
}

async function drawTable() {
    const data = await d3.csv("../data/lab3_data.csv");
    const columns = data.columns;
    const table = d3.select("#data-table");
    const tableBody = table.select("tbody");
    const status = d3.select("#table-status");
    let sortedColumn = null;
    let ascending = true;

    function updateRows(rows) {
        const bodyRows = tableBody
            .selectAll("tr")
            .data(rows)
            .join("tr");

        bodyRows
            .selectAll("td")
            .data(row => columns.map(column => ({
                column,
                value: row[column]
            })))
            .join("td")
            .attr("data-label", cell => columnLabels[cell.column] || cell.column)
            .text(cell => cell.value);
    }

    const headers = table
        .select("thead")
        .append("tr")
        .selectAll("th")
        .data(columns)
        .join("th")
        .attr("scope", "col")
        .attr("tabindex", 0)
        .attr("aria-sort", "none")
        .style("cursor", "pointer")
        .text(column => columnLabels[column] || column)
        .on("click", sortByColumn)
        .on("keydown", function (event, column) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                sortByColumn.call(this, event, column);
            }
        });

    function sortByColumn(event, column) {
        if (sortedColumn === column) {
            ascending = !ascending;
        } else {
            sortedColumn = column;
            ascending = true;
        }

        data.sort((left, right) =>
            compareValues(left, right, column, ascending)
        );

        headers
            .attr("aria-sort", header =>
                header === column
                    ? (ascending ? "ascending" : "descending")
                    : "none"
            )
            .classed("is-sorted", header => header === column)
            .text(header => {
                const label = columnLabels[header] || header;
                if (header !== column) {
                    return label;
                }
                return `${label} ${ascending ? "↑" : "↓"}`;
            });

        updateRows(data);
        status.text(
            `${data.length.toLocaleString()} records · sorted ${
                ascending ? "ascending" : "descending"
            }`
        );
    }

    updateRows(data);
    status.text(`${data.length.toLocaleString()} records`);
}

drawTable().catch(error => {
    d3.select("#table-status").text("Data unavailable");
    d3.select(".table-scroll")
        .append("p")
        .attr("class", "chart-error")
        .text(`The table data could not be loaded: ${error.message}`);
});
