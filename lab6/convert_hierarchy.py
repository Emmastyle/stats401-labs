"""Convert Lab 6 flat CSVs into nested JSON for D3 hierarchies.

Tutorial file:    data/lab6_small_hierarchy.csv
Assignment file:  data/lab6_assignment_gdp.csv

Run:

    python lab6/convert_hierarchy.py
"""

from pathlib import Path

import pandas as pd
import json


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"


def build_hierarchy(dataframe, levels, value_column):

    if len(levels) == 1:

        return [
            {
                "name": row[levels[0]],
                "value": int(row[value_column])
            }
            for _, row
            in dataframe.iterrows()
        ]

    current_level = levels[0]

    children = []

    for value, group in dataframe.groupby(
        current_level
    ):

        children.append({
            "name": value,
            "children": build_hierarchy(
                group,
                levels[1:],
                value_column
            )
        })

    return children


def build_gdp_hierarchy(dataframe, levels):

    if len(levels) == 1:

        return [
            {
                "name": row[levels[0]],
                "gdp": int(row["gdp_billion_usd"]),
                "status": row["gdp_status"]
            }
            for _, row
            in dataframe.iterrows()
        ]

    current_level = levels[0]

    children = []

    for value, group in dataframe.groupby(
        current_level
    ):

        children.append({
            "name": value,
            "children": build_gdp_hierarchy(
                group,
                levels[1:]
            )
        })

    return children


def convert_small_hierarchy():

    df = pd.read_csv(
        DATA_DIR / "lab6_small_hierarchy.csv"
    )

    hierarchy = {
        "name": "World",
        "children": build_hierarchy(
            df,
            [
                "continent",
                "country",
                "region",
                "city"
            ],
            "population_thousands"
        )
    }

    with open(
        DATA_DIR / "lab6_small_hierarchy.json",
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            hierarchy,
            f,
            indent=2,
            ensure_ascii=False
        )

    print(f"Wrote {DATA_DIR / 'lab6_small_hierarchy.json'}")


def convert_gdp_hierarchy():

    df = pd.read_csv(
        DATA_DIR / "lab6_assignment_gdp.csv"
    )

    hierarchy = {
        "name": "World",
        "children": build_gdp_hierarchy(
            df,
            [
                "continent",
                "area",
                "country"
            ]
        )
    }

    with open(
        DATA_DIR / "lab6_assignment_gdp.json",
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            hierarchy,
            f,
            indent=2,
            ensure_ascii=False
        )

    print(f"Wrote {DATA_DIR / 'lab6_assignment_gdp.json'}")


if __name__ == "__main__":
    convert_small_hierarchy()
    convert_gdp_hierarchy()
