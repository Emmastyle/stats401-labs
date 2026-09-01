"""Tasks 6-10: scrape five pages from Books to Scrape."""

import time
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup


BASE_URL = "https://books.toscrape.com/catalogue/page-{page}.html"
HEADERS = {"User-Agent": "STATS401-Class-Exercise/1.0"}
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def scrape_pages(page_count=5):
    """Download book titles and prices with pagination and error handling."""
    records = []

    for page in range(1, page_count + 1):
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
        print("Books on page:", len(books))

        for book in books:
            title = book.select_one("h3 a")["title"]
            price_text = book.select_one(".price_color").get_text(strip=True)
            price = float(price_text.replace("£", ""))
            records.append({"title": title, "price": price, "page": page})
            print(title, price)

        print("Downloaded page", page)
        if page < page_count:
            time.sleep(1)

    return records


def main():
    records = scrape_pages()
    print("Total records:", len(records))
    print(records[:3])

    DATA_DIR.mkdir(exist_ok=True)
    dataframe = pd.DataFrame(records)
    print(dataframe.head())
    dataframe.to_csv(DATA_DIR / "books.csv", index=False)
    dataframe.to_json(
        DATA_DIR / "books.json",
        orient="records",
        indent=2,
    )


if __name__ == "__main__":
    main()
