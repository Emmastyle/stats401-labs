"""Collect the 1,000-record Lab 3 assignment dataset.

Books to Scrape is a practice website created for web-scraping exercises:
https://books.toscrape.com/
"""

import time
from pathlib import Path
from urllib.robotparser import RobotFileParser

import pandas as pd
import requests
from bs4 import BeautifulSoup


BASE_URL = "https://books.toscrape.com/catalogue/page-{page}.html"
ROBOTS_URL = "https://books.toscrape.com/robots.txt"
HEADERS = {"User-Agent": "STATS401-Class-Exercise/1.0"}
PAGE_COUNT = 50
EXPECTED_RECORDS = 1000
REQUEST_DELAY_SECONDS = 1
DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "lab3_data.csv"
RATING_WORDS = {"One", "Two", "Three", "Four", "Five"}


def check_robots_txt():
    """Report whether the practice website publishes a robots.txt file."""
    try:
        response = requests.get(ROBOTS_URL, headers=HEADERS, timeout=10)
        if response.status_code == 404:
            print("No robots.txt file is published; using the designated practice site.")
            return
        response.raise_for_status()
        robots = RobotFileParser()
        robots.set_url(ROBOTS_URL)
        robots.parse(response.text.splitlines())
        if not robots.can_fetch(HEADERS["User-Agent"], BASE_URL.format(page=1)):
            raise RuntimeError("robots.txt does not permit this collection.")
        print("robots.txt permits this collection.")
    except requests.RequestException as error:
        print("Could not check robots.txt:")
        print(error)
        print("Continuing because Books to Scrape is a designated practice website.")


def parse_book(book, page):
    """Extract useful attributes from one product card."""
    title = book.select_one("h3 a")["title"]
    price_text = book.select_one(".price_color").get_text(strip=True)
    rating_classes = set(book.select_one(".star-rating").get("class", []))
    rating = next(
        (word for word in RATING_WORDS if word in rating_classes),
        "Unknown",
    )
    availability = " ".join(
        book.select_one(".availability").get_text(" ", strip=True).split()
    )

    return {
        "title": title,
        "price_gbp": float(price_text.replace("£", "")),
        "star_rating": rating,
        "availability": availability,
        "source_page": page,
    }


def collect_books():
    """Automatically paginate through all 50 catalogue pages."""
    records = []

    for page in range(1, PAGE_COUNT + 1):
        url = BASE_URL.format(page=page)

        try:
            response = requests.get(url, headers=HEADERS, timeout=10)
            response.raise_for_status()
        except requests.RequestException as error:
            print(f"Failed on page {page}:", error)
            continue

        response.encoding = response.apparent_encoding
        soup = BeautifulSoup(response.text, "html.parser")
        books = soup.select("article.product_pod")
        records.extend(parse_book(book, page) for book in books)
        print(f"Downloaded page {page}: {len(books)} records")

        if page < PAGE_COUNT:
            time.sleep(REQUEST_DELAY_SECONDS)

    return records


def main():
    check_robots_txt()
    time.sleep(REQUEST_DELAY_SECONDS)
    records = collect_books()

    if len(records) < EXPECTED_RECORDS:
        raise RuntimeError(
            f"Collected {len(records)} records; expected at least "
            f"{EXPECTED_RECORDS}. No incomplete dataset was saved."
        )

    dataframe = pd.DataFrame(records)
    DATA_PATH.parent.mkdir(exist_ok=True)
    dataframe.to_csv(DATA_PATH, index=False)
    print(f"Saved {len(dataframe)} records to {DATA_PATH}")
    print(dataframe.head())


if __name__ == "__main__":
    main()
