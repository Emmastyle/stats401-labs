"""Collect the 1,000-record Lab 3 assignment dataset.

Books to Scrape is a practice website created for web-scraping exercises:
https://books.toscrape.com/
"""

import time
from pathlib import Path
from urllib.parse import urljoin
from urllib.robotparser import RobotFileParser

import pandas as pd
import requests
from bs4 import BeautifulSoup


SITE_URL = "https://books.toscrape.com/"
ROBOTS_URL = "https://books.toscrape.com/robots.txt"
HEADERS = {"User-Agent": "STATS401-Class-Exercise/1.0"}
EXPECTED_RECORDS = 1000
EXPECTED_CATEGORIES = 50
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
        if not robots.can_fetch(HEADERS["User-Agent"], SITE_URL):
            raise RuntimeError("robots.txt does not permit this collection.")
        print("robots.txt permits this collection.")
    except requests.RequestException as error:
        print("Could not check robots.txt:")
        print(error)
        print("Continuing because Books to Scrape is a designated practice website.")


def parse_book(book, category):
    """Extract useful attributes from one product card."""
    title = book.select_one("h3 a")["title"]
    price_text = book.select_one(".price_color").get_text(strip=True)
    rating_classes = set(book.select_one(".star-rating").get("class", []))
    rating = next(
        (word for word in RATING_WORDS if word in rating_classes),
        "Unknown",
    )

    return {
        "title": title,
        "category": category,
        "price_gbp": float(price_text.replace("£", "")),
        "star_rating": rating,
    }


def fetch_soup(session, url):
    """Download and parse one page with error handling and rate limiting."""
    try:
        response = session.get(url, timeout=10)
        response.raise_for_status()
        response.encoding = response.apparent_encoding
        return BeautifulSoup(response.text, "html.parser")
    except requests.RequestException as error:
        print(f"Failed to download {url}:", error)
        return None
    finally:
        time.sleep(REQUEST_DELAY_SECONDS)


def collect_books():
    """Discover every category and automatically follow its pagination."""
    records = []
    session = requests.Session()
    session.headers.update(HEADERS)
    home_soup = fetch_soup(session, SITE_URL)

    if home_soup is None:
        return records

    category_links = [
        (link.get_text(strip=True), urljoin(SITE_URL, link["href"]))
        for link in home_soup.select("ul.nav-list > li > ul > li > a")
    ]
    print(f"Discovered {len(category_links)} categories")

    for category, category_url in category_links:
        page_number = 1
        next_url = category_url

        while next_url:
            soup = fetch_soup(session, next_url)
            if soup is None:
                break

            books = soup.select("article.product_pod")
            records.extend(parse_book(book, category) for book in books)
            print(
                f"Downloaded {category} page {page_number}: "
                f"{len(books)} records"
            )

            next_link = soup.select_one("li.next a")
            next_url = (
                urljoin(next_url, next_link["href"])
                if next_link is not None
                else None
            )
            page_number += 1

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
    if dataframe["category"].nunique() != EXPECTED_CATEGORIES:
        raise RuntimeError(
            f"Collected {dataframe['category'].nunique()} categories; "
            f"expected {EXPECTED_CATEGORIES}."
        )
    for column in ["category", "price_gbp", "star_rating"]:
        if dataframe[column].nunique() < 2:
            raise RuntimeError(f"{column} is not a useful varying attribute.")

    DATA_PATH.parent.mkdir(exist_ok=True)
    dataframe.to_csv(DATA_PATH, index=False)
    print(f"Saved {len(dataframe)} records to {DATA_PATH}")
    print(dataframe.head())


if __name__ == "__main__":
    main()
