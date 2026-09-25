"""Join OWID happiness, population, income-group, and GDP tables for the project."""

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "project"
OUT = ROOT / "data" / "project_life_satisfaction.csv"

EXTRA_CENTROIDS = {
    "KOS": (21.0, 42.6),
    "OWID_KOS": (21.0, 42.6),
    "TWN": (121.0, 23.7),
    "HKG": (114.2, 22.3),
    "SGP": (103.8, 1.35),
    "PSE": (35.2, 31.9),
}

INCOME_SHORT = {
    "High-income countries": "High",
    "Upper-middle-income countries": "Upper middle",
    "Lower-middle-income countries": "Lower middle",
    "Low-income countries": "Low",
}


def nearest_year_map(frame, value_col, years):
    lookup = {}
    grouped = {code: sub.set_index("Year")[value_col] for code, sub in frame.groupby("Code")}
    for code, series in grouped.items():
        series = series.dropna().sort_index()
        if series.empty:
            continue
        for year in years:
            if year in series.index:
                lookup[(code, year)] = series.loc[year]
            else:
                idx = (series.index.to_series() - year).abs().idxmin()
                lookup[(code, year)] = series.loc[idx]
    return lookup


def main():
    happiness = pd.read_csv(SRC / "happiness-raw.csv")
    income = pd.read_csv(SRC / "income-raw.csv")
    population = pd.read_csv(SRC / "population-raw.csv")
    gdp = pd.read_csv(SRC / "gdp-raw.csv")
    centroids = pd.read_csv(SRC / "centroids-iso2.csv")
    iso = pd.read_csv(SRC / "iso-all.csv")

    def countries_only(frame):
        code = frame["Code"].fillna("")
        return frame[code.str.fullmatch(r"[A-Z]{3}")].copy()

    happiness = countries_only(happiness)
    happiness = happiness.rename(columns={"Self-reported life satisfaction": "happiness"})
    years = sorted(happiness["Year"].unique())

    population = countries_only(population)
    income = countries_only(income)
    income = income.rename(columns={"World Bank's income classification": "income_raw"})
    gdp = countries_only(gdp)
    gdp = gdp.rename(columns={"GDP per capita": "gdp"})

    pop_lookup = nearest_year_map(population, "Population", years)
    income_lookup = nearest_year_map(income, "income_raw", years)
    gdp_lookup = nearest_year_map(gdp, "gdp", years)

    iso2_to_iso3 = dict(zip(iso["alpha-2"], iso["alpha-3"]))
    centroids["iso"] = centroids["ISO"].map(iso2_to_iso3)
    centroid_lookup = {
        row.iso: (row.longitude, row.latitude)
        for row in centroids.dropna(subset=["iso"]).itertuples()
    }
    centroid_lookup.update(EXTRA_CENTROIDS)

    def continent_of(code):
        match = iso.loc[iso["alpha-3"] == code]
        if match.empty:
            return "Other"
        region = match.iloc[0]["region"]
        intermediate = match.iloc[0]["intermediate-region"]
        if region == "Americas":
            return "South America" if intermediate == "South America" else "North America"
        return region if pd.notna(region) and region else "Other"

    rows = []
    missing_geo = set()
    for row in happiness.itertuples():
        lonlat = centroid_lookup.get(row.Code)
        if lonlat is None:
            missing_geo.add((row.Code, row.Entity))
            continue
        lon, lat = lonlat
        pop = pop_lookup.get((row.Code, row.Year))
        income_name = income_lookup.get((row.Code, row.Year))
        gdp_value = gdp_lookup.get((row.Code, row.Year))
        rows.append(
            {
                "country": row.Entity,
                "iso": row.Code,
                "year": int(row.Year),
                "happiness": round(float(row.happiness), 3),
                "population": None if pd.isna(pop) else int(pop),
                "gdp": None if gdp_value is None or pd.isna(gdp_value) else round(float(gdp_value), 1),
                "income_group": INCOME_SHORT.get(income_name, income_name),
                "continent": continent_of(row.Code),
                "lon": round(float(lon), 4),
                "lat": round(float(lat), 4),
            }
        )

    out = pd.DataFrame(rows).sort_values(["year", "country"])
    out.to_csv(OUT, index=False)
    print("wrote", OUT, "rows", len(out), "countries", out.iso.nunique())
    print("years", sorted(out.year.unique()))
    print("income", out.income_group.value_counts(dropna=False).to_dict())
    print("gdp missing", int(out.gdp.isna().sum()))
    if missing_geo:
        print("dropped without centroids", missing_geo)


if __name__ == "__main__":
    main()
