"""Tasks 11-13: request, select, and save JSONPlaceholder API data."""

from pathlib import Path

import pandas as pd
import requests


API_URL = "https://jsonplaceholder.typicode.com/posts"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def request_posts(params=None):
    """Request posts and raise an error for unsuccessful responses."""
    response = requests.get(API_URL, params=params, timeout=10)
    response.raise_for_status()
    return response.json()


def main():
    try:
        data = request_posts()
    except requests.RequestException as error:
        print("Request failed:")
        print(error)
        return

    print(type(data))
    print(len(data))
    print(data[0])

    records = []
    for post in data:
        records.append(
            {
                "id": post["id"],
                "user_id": post["userId"],
                "title": post["title"],
            }
        )

    DATA_DIR.mkdir(exist_ok=True)
    dataframe = pd.DataFrame(records)
    dataframe.to_csv(DATA_DIR / "posts.csv", index=False)

    try:
        user_one_posts = request_posts(params={"userId": 1})
        print("Posts for user 1:", len(user_one_posts))
    except requests.RequestException as error:
        print("Filtered request failed:")
        print(error)


if __name__ == "__main__":
    main()
