const tooltip = d3.select("#tooltip");
const missingFill = "#e6e1d6";
const mapWidth = 1000;
const mapHeight = 560;

const regionMembers = {
    Africa: ["TZA", "ESH", "COD", "SOM", "KEN", "SDN", "TCD", "ZAF", "LSO", "ZWE", "BWA", "NAM", "SEN", "MLI", "MRT", "BEN", "NER", "NGA", "CMR", "TGO", "GHA", "CIV", "GIN", "GNB", "LBR", "SLE", "BFA", "CAF", "COG", "GAB", "GNQ", "ZMB", "MWI", "MOZ", "SWZ", "AGO", "BDI", "MDG", "GMB", "TUN", "DZA", "ERI", "MAR", "EGY", "LBY", "ETH", "DJI", "SOL", "UGA", "RWA", "SSD"],
    Asia: ["KAZ", "UZB", "IDN", "TLS", "ISR", "LBN", "PSE", "JOR", "ARE", "QAT", "KWT", "IRQ", "OMN", "KHM", "THA", "LAO", "MMR", "VNM", "PRK", "KOR", "MNG", "IND", "BGD", "BTN", "NPL", "PAK", "AFG", "TJK", "KGZ", "TKM", "IRN", "SYR", "ARM", "TUR", "LKA", "CHN", "TWN", "AZE", "GEO", "PHL", "MYS", "BRN", "JPN", "YEM", "SAU", "CYN", "CYP", "SGP", "HKG"],
    Europe: ["RUS", "NOR", "SWE", "BLR", "UKR", "POL", "AUT", "HUN", "MDA", "ROU", "LTU", "LVA", "EST", "DEU", "BGR", "GRC", "ALB", "HRV", "CHE", "LUX", "BEL", "NLD", "PRT", "ESP", "IRL", "FRA", "ITA", "DNK", "GBR", "ISL", "SVN", "FIN", "SVK", "CZE", "BIH", "MKD", "SRB", "MNE", "KOS"],
    "North America": ["CAN", "USA", "HTI", "DOM", "BHS", "GRL", "MEX", "PAN", "CRI", "NIC", "HND", "SLV", "GTM", "BLZ", "PRI", "JAM", "CUB", "TTO"],
    "South America": ["ARG", "CHL", "FLK", "URY", "BRA", "BOL", "PER", "COL", "VEN", "GUY", "SUR", "ECU", "PRY"],
    Oceania: ["FJI", "PNG", "VUT", "NCL", "SLB", "NZL", "AUS"],
    Antarctica: ["ATF", "ATA"]
};

const regionByIso3 = {};
Object.entries(regionMembers).forEach(function (entry) {
    entry[1].forEach(function (iso3) {
        regionByIso3[iso3] = entry[0];
    });
});

const regionFrames = {
    Africa: [[-18, -35], [52, 37]],
    Asia: [[25, -10], [146, 55]],
    Europe: [[-25, 34], [42, 72]],
    "North America": [[-168, 7], [-52, 75]],
    "South America": [[-82, -56], [-34, 13]],
    Oceania: [[112, -48], [178, -1]]
};

const countryAliases = {
    "usa": "USA",
    "us": "USA",
    "america": "USA",
    "united states of america": "USA",
    "uk": "GBR",
    "britain": "GBR",
    "great britain": "GBR",
    "england": "GBR",
    "korea": "KOR",
    "republic of korea": "KOR",
    "uae": "ARE",
    "emirates": "ARE",
    "turkey": "TUR",
    "turkiye": "TUR",
    "czech republic": "CZE",
    "russia": "RUS",
    "russian federation": "RUS",
    "holland": "NLD",
    "ivory coast": "CIV",
    "drc": "COD",
    "dr congo": "COD",
    "democratic republic of the congo": "COD",
    "equatorial guinea": "GNQ",
    "western sahara": "ESH",
    "prc": "CHN"
};

const state = {
    activeId: null,
    pinnedId: null,
    region: null,
    zoom: null,
    choroplethSvg: null,
    projection: null,
    path: null,
    stats: [],
    byName: new Map(),
    byIso: new Map(),
    ready: false
};

function normalizeName(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function cleanTarget(value) {
    return normalizeName(value)
        .replace(/^(the|to|only|just|a|an)\s+/, "")
        .replace(/\s+(please|now|countries|country|region|map)$/, "")
        .trim();
}

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
        Region: ${d.properties.region}<br>
        ISO-3: ${d.properties.iso3}<br>
        2025 GDP: ${formatGdp(value)}
        ${rank ? `<br>Rank: ${rank}` : ""}
        ${value == null ? "<br>Not in the top-50 file" : ""}
    `;
}

function featureFill(d, colorScale) {
    return d.properties.value == null ? missingFill : colorScale(d.properties.value);
}

function setAction(text, isError) {
    d3.select("#voice-action")
        .classed("is-error", Boolean(isError))
        .text(text);
}

function updateRegionButtons() {
    d3.selectAll("[data-region]").classed("is-selected", function () {
        return this.dataset.region === state.region;
    });
}

function applyCountryState() {
    d3.selectAll(".country")
        .classed("is-filtered-out", function (d) {
            return Boolean(state.region) && d.properties.region !== state.region;
        })
        .classed("is-active", function (d) {
            return Boolean(state.activeId) && d.properties.iso3 === state.activeId;
        })
        .attr("stroke", function (d) {
            return state.activeId && d.properties.iso3 === state.activeId ? "#111111" : "#ffffff";
        })
        .attr("stroke-width", function (d) {
            return state.activeId && d.properties.iso3 === state.activeId ? 2 : 0.7;
        });
}

function setActive(iso3) {
    state.activeId = iso3;
    applyCountryState();

    const label = d3.select("#active-country");
    if (!iso3) {
        if (state.region) {
            const count = state.stats.filter(function (d) {
                return regionByIso3[d.iso3] === state.region;
            }).length;
            label.text(`Showing ${state.region}. ${count} of the top 50 economies are in this region. Countries outside it are dimmed.`);
        } else {
            label.text("Hover or click a country to highlight it in both maps.");
        }
        return;
    }

    const node = state.byIso.get(iso3);
    if (!node) {
        label.text(iso3);
        return;
    }
    const valueText = node.properties.value == null
        ? "no GDP value in the provided file"
        : `${formatGdp(node.properties.value)}${node.properties.rank ? ` · rank ${node.properties.rank}` : ""}`;
    const regionNote = state.region ? ` · filter: ${state.region}` : "";
    label.text(`${node.properties.name} · ${node.properties.region} · ${valueText}${regionNote}`);
}

function rememberName(name, feature) {
    const key = cleanTarget(name);
    if (key && !state.byName.has(key)) {
        state.byName.set(key, feature);
    }
}

function findCountry(raw) {
    const key = cleanTarget(raw);
    if (!key) return null;
    if (countryAliases[key]) {
        return state.byIso.get(countryAliases[key]) || null;
    }
    return state.byName.get(key) || null;
}

function regionFromTarget(raw) {
    const key = cleanTarget(raw);
    const exact = {
        "asia": "Asia",
        "asian": "Asia",
        "europe": "Europe",
        "european": "Europe",
        "africa": "Africa",
        "african": "Africa",
        "oceania": "Oceania",
        "north america": "North America",
        "north american": "North America",
        "south america": "South America",
        "south american": "South America"
    };
    return exact[key] || null;
}

function finiteBox(bounds) {
    return bounds
        && Number.isFinite(bounds[0][0])
        && Number.isFinite(bounds[0][1])
        && Number.isFinite(bounds[1][0])
        && Number.isFinite(bounds[1][1]);
}

function zoomToward(x, y, scale) {
    if (!state.choroplethSvg || !state.zoom) return;
    const tx = mapWidth / 2 - scale * x;
    const ty = mapHeight / 2 - scale * y;
    state.choroplethSvg.transition().duration(650).call(
        state.zoom.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
}

function zoomToBounds(x0, y0, x1, y1) {
    const dx = Math.max(x1 - x0, 1);
    const dy = Math.max(y1 - y0, 1);
    const scale = Math.max(1, Math.min(8, 0.82 / Math.max(dx / mapWidth, dy / mapHeight)));
    const tx = mapWidth / 2 - scale * (x0 + x1) / 2;
    const ty = mapHeight / 2 - scale * (y0 + y1) / 2;
    if (!state.choroplethSvg || !state.zoom) return;
    state.choroplethSvg.transition().duration(650).call(
        state.zoom.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
}

function zoomToFeature(feature) {
    if (!state.path) return;
    const bounds = state.path.bounds(feature);
    if (!finiteBox(bounds)) return;
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    if (dx > mapWidth * 0.72 || dy > mapHeight * 0.72) {
        const center = state.path.centroid(feature);
        if (!center || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) return;
        zoomToward(center[0], center[1], 2.2);
        return;
    }
    zoomToBounds(bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]);
}

function zoomToGeoBox(box) {
    if (!state.projection || !box) return;
    const corners = [
        [box[0][0], box[0][1]],
        [box[1][0], box[0][1]],
        [box[0][0], box[1][1]],
        [box[1][0], box[1][1]]
    ].map(function (lonlat) {
        return state.projection(lonlat);
    }).filter(function (point) {
        return point && Number.isFinite(point[0]) && Number.isFinite(point[1]);
    });
    if (corners.length < 2) return;
    zoomToBounds(
        d3.min(corners, function (d) { return d[0]; }),
        d3.min(corners, function (d) { return d[1]; }),
        d3.max(corners, function (d) { return d[0]; }),
        d3.max(corners, function (d) { return d[1]; })
    );
}

function zoomBy(factor) {
    if (!state.choroplethSvg || !state.zoom) return;
    state.choroplethSvg.transition().duration(400).call(state.zoom.scaleBy, factor);
}

function highlightCountry(country) {
    const feature = findCountry(country);
    if (!feature) return false;
    if (state.region && feature.properties.region !== state.region) {
        state.region = null;
        updateRegionButtons();
    }
    state.pinnedId = feature.properties.iso3;
    const hasOption = !d3.select(`#country-select option[value="${feature.properties.iso3}"]`).empty();
    d3.select("#country-select").property("value", hasOption ? feature.properties.iso3 : "");
    setActive(feature.properties.iso3);
    zoomToFeature(feature);
    setAction(`Highlighting ${feature.properties.name}`);
    return true;
}

function filterRegion(region) {
    if (!regionFrames[region]) return false;
    state.region = region;
    state.pinnedId = null;
    d3.select("#country-select").property("value", "");
    updateRegionButtons();
    setActive(null);
    zoomToGeoBox(regionFrames[region]);
    setAction(`Showing ${region}`);
    return true;
}

function resetVisualization() {
    state.region = null;
    state.pinnedId = null;
    d3.select("#country-select").property("value", "");
    updateRegionButtons();
    setActive(null);
    if (state.choroplethSvg && state.zoom) {
        state.choroplethSvg.transition().duration(500).call(state.zoom.transform, d3.zoomIdentity);
    }
    setAction("Resetting the map");
}

function showCommandError(command) {
    const heard = command ? `"${command}"` : "empty command";
    d3.select("#voice-heard").text(heard);
    setAction('Command not recognized. Try: "Show Asia", "Highlight Japan", "Reset"', true);
}

function handleVoiceCommand(command) {
    const text = command.toLowerCase().trim();

    if (!text) {
        showCommandError(text);
        return;
    }

    if (
        text.includes("reset")
        || text.includes("show all")
        || text.includes("clear filter")
        || text === "clear"
    ) {
        resetVisualization();
        return;
    }

    if (text.includes("zoom in")) {
        zoomBy(1.6);
        setAction("Zooming in");
        return;
    }

    if (text.includes("zoom out")) {
        zoomBy(1 / 1.6);
        setAction("Zooming out");
        return;
    }

    const lead = text.match(/^(?:please\s+)?(highlight|select|find|show|filter)(?:\s+me)?\s+(.+)$/);
    if (lead) {
        const verb = lead[1];
        const target = lead[2];
        const region = regionFromTarget(target);
        const country = findCountry(target);
        if ((verb === "show" || verb === "filter") && region && !country) {
            filterRegion(region);
            return;
        }
        if (country) {
            highlightCountry(target);
            return;
        }
        if (region) {
            filterRegion(region);
            return;
        }
        showCommandError(text);
        return;
    }

    const region = regionFromTarget(text);
    const country = findCountry(text);
    if (region && !country) {
        filterRegion(region);
        return;
    }
    if (country) {
        highlightCountry(text);
        return;
    }
    showCommandError(text);
}

function setupVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const button = d3.select("#voice-button");

    if (!SpeechRecognition) {
        d3.select("#voice-status").text("Speech recognition is not supported in this browser. Use the buttons or keyboard.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    let wantListening = false;
    let finalTranscript = "";
    let interimTranscript = "";
    let settleTimer = null;
    let idleTimer = null;
    let quickEnds = 0;

    function clearVoiceTimers() {
        clearTimeout(settleTimer);
        clearTimeout(idleTimer);
        settleTimer = null;
        idleTimer = null;
    }

    function currentCommand() {
        return `${finalTranscript} ${interimTranscript}`.replace(/\s+/g, " ").trim().toLowerCase();
    }

    function showHeard(text, status) {
        d3.select("#voice-status").text(status);
        d3.select("#voice-heard").text(text ? `"${text}"` : "—");
    }

    function resetVoiceButton() {
        button.classed("is-selected", false).text("Start Voice Control");
    }

    function runCommandAndStop() {
        const command = currentCommand();
        clearVoiceTimers();
        wantListening = false;
        finalTranscript = "";
        interimTranscript = "";
        if (command) {
            showHeard(command, `Heard: ${command}`);
            handleVoiceCommand(command);
        }
        try {
            recognition.stop();
        } catch (error) {
            resetVoiceButton();
        }
    }

    function armSettle() {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(runCommandAndStop, 1200);
    }

    function armIdle() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function () {
            if (!wantListening || currentCommand()) return;
            wantListening = false;
            clearVoiceTimers();
            showHeard("", "No speech detected. Click Start Voice Control and try again.");
            setAction('Try: "Show Asia", "Highlight Japan", "Reset"', true);
            try {
                recognition.stop();
            } catch (error) {
                resetVoiceButton();
            }
        }, 12000);
    }

    button.on("click", function (event) {
        event.preventDefault();
        if (!state.ready) return;
        if (wantListening) {
            runCommandAndStop();
            return;
        }
        finalTranscript = "";
        interimTranscript = "";
        wantListening = true;
        showHeard("", "Listening...");
        setAction("Waiting for a command");
        try {
            recognition.start();
        } catch (error) {
            wantListening = false;
            resetVoiceButton();
            d3.select("#voice-status").text("The microphone is already in use. Try again in a moment.");
            return;
        }
        requestAnimationFrame(function () {
            if (!wantListening) return;
            button.classed("is-selected", true).text("Stop Voice Control");
        });
    });

    recognition.onstart = function () {
        if (!wantListening) return;
        quickEnds = 0;
        button.classed("is-selected", true).text("Stop Voice Control");
        armIdle();
    };

    recognition.onresult = function (event) {
        interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const piece = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript = `${finalTranscript} ${piece}`.replace(/\s+/g, " ").trim();
            } else {
                interimTranscript += piece;
            }
        }
        const shown = currentCommand();
        if (shown) {
            showHeard(shown, "Listening...");
            setAction("Still listening");
            armSettle();
        }
        armIdle();
    };

    recognition.onerror = function (event) {
        if (event.error === "aborted" || event.error === "no-speech") return;
        wantListening = false;
        clearVoiceTimers();
        const denied = event.error === "not-allowed" || event.error === "service-not-allowed";
        const message = {
            "not-allowed": "Microphone permission was denied. Use the buttons or keyboard.",
            "service-not-allowed": "Microphone permission was denied. Use the buttons or keyboard.",
            "audio-capture": "No microphone was found. Use the buttons or keyboard.",
            "network": "The speech service could not be reached. Use the buttons or keyboard."
        }[event.error] || "Voice recognition failed. Use the buttons or keyboard.";
        d3.select("#voice-status").text(message);
        if (denied || event.error === "audio-capture") {
            setAction("Use the region buttons, the country menu, or the keyboard.");
        } else {
            setAction('Command not recognized. Try: "Show Asia", "Highlight Japan", "Reset"', true);
        }
        resetVoiceButton();
    };

    recognition.onend = function () {
        if (interimTranscript) {
            finalTranscript = `${finalTranscript} ${interimTranscript}`.replace(/\s+/g, " ").trim();
            interimTranscript = "";
        }
        if (wantListening) {
            quickEnds += 1;
            if (quickEnds > 6) {
                wantListening = false;
                clearVoiceTimers();
                d3.select("#voice-status").text("Listening stopped. Click Start Voice Control and try again.");
                resetVoiceButton();
                return;
            }
            setTimeout(function () {
                if (!wantListening) return;
                try {
                    recognition.start();
                } catch (error) {
                    // Chrome ends a session on its own. The next onend will try again.
                }
            }, 200);
            return;
        }
        clearVoiceTimers();
        resetVoiceButton();
    };
}

function bindCountryEvents(selection) {
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
        .on("mouseout", function () {
            hideTooltip();
            setActive(state.pinnedId);
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
            const hasOption = !d3.select(`#country-select option[value="${d.properties.iso3}"]`).empty();
            d3.select("#country-select").property("value", hasOption ? d.properties.iso3 : "");
            setActive(d.properties.iso3);
            setAction(`Highlighting ${d.properties.name}`);
        });
}

function landForFit(geoData) {
    return {
        type: "FeatureCollection",
        features: geoData.features.filter(function (d) {
            return d.properties.iso3 !== "ATA";
        })
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
        .attr("offset", function (d) { return `${d * 100}%`; })
        .attr("stop-color", function (d) {
            return colorScale(Math.exp(logMin + d * (logMax - logMin)));
        });

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
                .tickFormat(function (d) { return `$${d3.format("~s")(d)}b`; })
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
    state.projection = projection;
    state.path = path;

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
        .attr("fill", function (d) { return featureFill(d, colorScale); })
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.7);

    bindCountryEvents(countries);

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
}

function quantile(values, p) {
    if (!values.length) return 0;
    const i = Math.max(0, Math.min(values.length - 1, Math.floor(p * (values.length - 1))));
    return values[i];
}

function fitProjectedCollection(features, path, width, height, pad) {
    const boxes = features
        .map(function (feature) { return path.bounds(feature); })
        .filter(finiteBox);

    const centersX = boxes.map(function (b) { return (b[0][0] + b[1][0]) / 2; }).sort(function (a, b) { return a - b; });
    const centersY = boxes.map(function (b) { return (b[0][1] + b[1][1]) / 2; }).sort(function (a, b) { return a - b; });
    const cx0 = quantile(centersX, 0.03);
    const cx1 = quantile(centersX, 0.97);
    const cy0 = quantile(centersY, 0.03);
    const cy1 = quantile(centersY, 0.97);

    const kept = boxes.filter(function (b) {
        const cx = (b[0][0] + b[1][0]) / 2;
        const cy = (b[0][1] + b[1][1]) / 2;
        return cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1;
    });
    const used = kept.length ? kept : boxes;

    const x0 = d3.min(used, function (b) { return b[0][0]; });
    const x1 = d3.max(used, function (b) { return b[1][0]; });
    const y0 = d3.min(used, function (b) { return b[0][1]; });
    const y1 = d3.max(used, function (b) { return b[1][1]; });
    const boxWidth = Math.max(x1 - x0, 1);
    const boxHeight = Math.max(y1 - y0, 1);
    const scale = 0.97 * Math.min((width - pad * 2) / boxWidth, (height - pad * 2) / boxHeight);
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
        features: geoData.features.filter(function (d) {
            return d.properties.iso3 !== "ATA";
        })
    };
    const topology = topojson.topology({ countries: land }, 1e4);
    const projection = d3.geoNaturalEarth1()
        .fitExtent([[24, 18], [mapWidth - 24, mapHeight - 18]], land);
    const floor = d3.min(stats, function (d) { return d.value; }) * 0.05;

    const carto = topogram.cartogram()
        .projection(projection)
        .iterations(36)
        .properties(function (geom) { return geom.properties; })
        .value(function (feature) { return cartogramValue(feature, floor); });

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
        .attr("transform", fitProjectedCollection(warped.features, path, mapWidth, mapHeight, 16));

    const countries = mapGroup.selectAll(".country")
        .data(warped.features)
        .join("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("fill", function (d) { return featureFill(d, colorScale); })
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.6);

    bindCountryEvents(countries);

    svg.on("click", function () {
        state.pinnedId = null;
        d3.select("#country-select").property("value", "");
        setActive(null);
    });

    status.text("Area encodes GDP");
}

function populateSelect(stats) {
    const select = d3.select("#country-select");
    select.selectAll("option.country-option")
        .data(stats)
        .join("option")
        .attr("class", "country-option")
        .attr("value", function (d) { return d.iso3; })
        .text(function (d) { return `${d.rank}. ${d.country}`; });

    select.on("change", function () {
        const iso3 = this.value;
        if (!iso3) {
            state.pinnedId = null;
            setActive(null);
            setAction("Cleared the country highlight");
            return;
        }
        const feature = state.byIso.get(iso3);
        if (feature) {
            highlightCountry(feature.properties.name);
        }
    });
}

function enableFallbackControls() {
    d3.selectAll(".fallback-control").attr("disabled", null);
    d3.select("#country-select").attr("disabled", null);
}

d3.select("#reset-view").on("click", resetVisualization);
d3.select("#zoom-in").on("click", function () {
    zoomBy(1.6);
    setAction("Zooming in");
});
d3.select("#zoom-out").on("click", function () {
    zoomBy(1 / 1.6);
    setAction("Zooming out");
});
d3.selectAll("[data-region]").on("click", function () {
    filterRegion(this.dataset.region);
});

d3.select(document).on("keydown.lab10", function (event) {
    if (!state.ready) return;
    const tag = event.target && event.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const key = event.key.toLowerCase();
    const regions = {
        a: "Asia",
        e: "Europe",
        n: "North America",
        s: "South America",
        f: "Africa",
        o: "Oceania"
    };

    if (key === "r" || key === "escape") {
        resetVisualization();
        event.preventDefault();
    } else if (regions[key]) {
        filterRegion(regions[key]);
        event.preventDefault();
    } else if (key === "+" || key === "=") {
        zoomBy(1.6);
        setAction("Zooming in");
        event.preventDefault();
    } else if (key === "-" || key === "_") {
        zoomBy(1 / 1.6);
        setAction("Zooming out");
        event.preventDefault();
    }
});

setupVoice();

Promise.all([
    d3.json("../data/world.geojson"),
    d3.csv("../data/lab9_gdp_2025_top50.csv", function (d) {
        return {
            iso3: d.iso3,
            country: d.country,
            value: +d.gdp_2025_billion_usd,
            rank: +d.rank
        };
    })
]).then(function (loaded) {
    const geoData = loaded[0];
    const stats = loaded[1];
    state.stats = stats;
    const valueById = new Map(stats.map(function (d) { return [d.iso3, d]; }));

    geoData.features.forEach(function (feature) {
        const row = valueById.get(feature.properties.iso3);
        feature.properties.geoName = feature.properties.name;
        feature.properties.value = row ? row.value : undefined;
        feature.properties.rank = row ? row.rank : undefined;
        feature.properties.region = regionByIso3[feature.properties.iso3] || "Other";
        if (row) {
            feature.properties.name = row.country;
        }
        state.byIso.set(feature.properties.iso3, feature);
        rememberName(feature.properties.name, feature);
        rememberName(feature.properties.geoName, feature);
    });

    const missingRegion = geoData.features.filter(function (d) {
        return d.properties.region === "Other";
    });
    const matched = stats.filter(function (d) {
        return geoData.features.some(function (f) { return f.properties.iso3 === d.iso3; });
    });
    d3.select("#join-status").text(
        missingRegion.length
            ? `Missing region for ${missingRegion.map(function (d) { return d.properties.iso3; }).join(", ")}`
            : `Joined ${matched.length} / ${stats.length} ISO-3 codes`
    );

    const values = stats.map(function (d) { return d.value; });
    const colorScale = d3.scaleSequentialLog(d3.interpolateBlues).domain(d3.extent(values));

    populateSelect(stats);
    drawLegend(colorScale, values);
    drawChoropleth(geoData, colorScale);
    drawCartogram(geoData, colorScale, stats);

    state.ready = true;
    enableFallbackControls();
    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
        d3.select("#voice-button").attr("disabled", null);
    }
}).catch(function (error) {
    d3.select("#join-status").text("Could not load map data");
    d3.select("#choropleth").append("p")
        .attr("class", "chart-error")
        .text(`The maps could not be drawn. ${error.message}`);
    d3.select("#voice-status").text("The map did not load, so voice commands are unavailable.");
});
