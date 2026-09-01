# Lab 3 — Web Data Acquisition with Python

**STATS 401: Data Acquisition and Visualization**

## Learning Objectives

By the end of this lab, you should be able to:

1. Explain the workflow of acquiring data from the web.
2. Send HTTP requests using Python's `requests` library.
3. Inspect HTTP responses and status codes.
4. Understand basic HTML structure and CSS selectors.
5. Parse and scrape HTML using `BeautifulSoup`.
6. Extract repeated webpage records into structured Python data.
7. Obtain and parse JSON data from a REST API.
8. Handle basic pagination and rate limiting.
9. Save acquired data as CSV or JSON.
10. Consider `robots.txt`, terms of service, privacy, and server load before collecting web data.

---

# 0. Web Data Acquisition Workflow

In Labs 1 and 2, datasets were already provided. In this lab, you will obtain data yourself.

```text
Web page / API
       ↓
     Python
       ↓
   Raw data
       ↓
   CSV / JSON
       ↓
Cleaning and visualization
```

We will learn two approaches:

### HTML scraping

```text
Webpage → requests → HTML → BeautifulSoup → records → CSV/JSON
```

### REST API

```text
API → requests → JSON → Python → records → CSV/JSON
```

---

# Task 1 — Set Up Python

Install the required packages:

```bash
pip install requests beautifulsoup4 pandas
```

Test them:

```python
import requests
from bs4 import BeautifulSoup
import pandas as pd

print("Libraries loaded successfully")
```

Recommended structure:

```text
stats401-labs/
├── data/
└── lab3/
    ├── index.html
    ├── scrape_example.py
    └── api_example.py
```

---

# Task 2 — HTTP Requests

When you visit a webpage, your browser sends an HTTP request and the server returns a response.

```text
Your computer → HTTP request → Web server
Your computer ← HTTP response ← Web server
```

## 2.1 Send a GET Request

```python
import requests

url = "https://example.com"
response = requests.get(url, timeout=10)

print(response)
print(response.status_code)
```

Common status codes:

| Status | Meaning |
|---|---|
| `200` | Success |
| `301/302` | Redirect |
| `400` | Bad request |
| `401` | Authentication required |
| `403` | Forbidden |
| `404` | Not found |
| `429` | Too many requests |
| `500` | Server error |

A useful pattern is:

```python
response = requests.get(url, timeout=10)
response.raise_for_status()
print("Request successful")
```

## 2.2 Inspect the Response

For an HTML page:

```python
print(response.text)
```

You may receive:

```html
<html>
<body>
    <h1>Example Page</h1>
    <p>Hello!</p>
</body>
</html>
```

## 2.3 Add a User-Agent

```python
headers = {
    "User-Agent": "STATS401-Class-Exercise/1.0"
}

response = requests.get(
    url,
    headers=headers,
    timeout=10
)
```

Use an informative user agent when appropriate rather than attempting to disguise automated access.

---

# Task 3 — Understand HTML Structure

Consider:

```html
<div class="book">
    <h2 class="title">Data Visualization</h2>
    <p class="price">$35.00</p>
</div>

<div class="book">
    <h2 class="title">Learning Python</h2>
    <p class="price">$42.00</p>
</div>
```

This represents repeated records:

```text
Book
 ├── title
 └── price
```

A common scraping strategy is:

1. Find the repeated container.
2. Loop through each container.
3. Extract the fields.
4. Store each record as a Python dictionary.

---

# Task 4 — Parse HTML with BeautifulSoup

```python
from bs4 import BeautifulSoup

html = """
<html>
<body>
    <h1>Book Store</h1>
    <p class="description">Welcome to our store.</p>
</body>
</html>
"""

soup = BeautifulSoup(html, "html.parser")
```

Find by tag:

```python
heading = soup.find("h1")
print(heading.get_text(strip=True))
```

Find by class:

```python
description = soup.find(
    "p",
    class_="description"
)

print(description.get_text(strip=True))
```

Find multiple elements:

```python
books = soup.find_all(
    "div",
    class_="book"
)

for book in books:
    print(book.get_text(strip=True))
```

---

# Task 5 — CSS Selectors

BeautifulSoup can use CSS selectors.

Select by tag:

```python
soup.select("h2")
```

Select by class:

```python
soup.select(".book")
```

Select by ID:

```python
soup.select("#main-content")
```

Select a nested element:

```python
soup.select(".book .title")
```

Use `select_one()` for one element:

```python
soup.select_one(".title")
```

Use `select()` for multiple elements:

```python
soup.select(".title")
```

---

# Task 6 — Scrape a Real Practice Website

We will use **Books to Scrape**, a website designed for scraping practice:

```text
https://books.toscrape.com/
```

Create `lab3/scrape_example.py`:

```python
import requests
from bs4 import BeautifulSoup

url = "https://books.toscrape.com/"

headers = {
    "User-Agent": "STATS401-Class-Exercise/1.0"
}

response = requests.get(
    url,
    headers=headers,
    timeout=10
)

response.raise_for_status()

soup = BeautifulSoup(
    response.text,
    "html.parser"
)
```

Before writing selectors, inspect the page:

```text
Right Click → Inspect → Elements
```

A book is contained in HTML similar to:

```html
<article class="product_pod">
    <h3>
        <a title="A Light in the Attic">...</a>
    </h3>
    <p class="price_color">£51.77</p>
</article>
```

Select all books:

```python
books = soup.select("article.product_pod")

print("Books on page:", len(books))
```

Extract one title:

```python
book = books[0]

title = book.select_one("h3 a")["title"]

print(title)
```

Extract one price:

```python
price = book.select_one(
    ".price_color"
).get_text(strip=True)

print(price)
```

Extract all records:

```python
records = []

for book in books:

    title = book.select_one("h3 a")["title"]

    price_text = book.select_one(
        ".price_color"
    ).get_text(strip=True)

    price = float(
        price_text.replace("£", "")
    )

    records.append({
        "title": title,
        "price": price
    })

print(records[:3])
```

You have transformed:

```text
HTML → Python dictionaries → structured data
```

---

# Task 7 — Save Scraped Data

```python
import pandas as pd

df = pd.DataFrame(records)

print(df.head())
```

Save CSV:

```python
df.to_csv(
    "../data/books.csv",
    index=False
)
```

Save JSON:

```python
df.to_json(
    "../data/books.json",
    orient="records",
    indent=2
)
```

---

# Task 8 — Pagination

Many websites divide records across pages.

Books to Scrape uses URLs such as:

```text
https://books.toscrape.com/catalogue/page-1.html
https://books.toscrape.com/catalogue/page-2.html
https://books.toscrape.com/catalogue/page-3.html
```

Generate URLs:

```python
for page in range(1, 6):

    url = (
        "https://books.toscrape.com/"
        f"catalogue/page-{page}.html"
    )

    print(url)
```

Scrape several pages:

```python
import requests
from bs4 import BeautifulSoup

records = []

for page in range(1, 6):

    url = (
        "https://books.toscrape.com/"
        f"catalogue/page-{page}.html"
    )

    response = requests.get(
        url,
        timeout=10
    )

    response.raise_for_status()

    soup = BeautifulSoup(
        response.text,
        "html.parser"
    )

    books = soup.select(
        "article.product_pod"
    )

    for book in books:

        title = book.select_one(
            "h3 a"
        )["title"]

        price = book.select_one(
            ".price_color"
        ).get_text(strip=True)

        records.append({
            "title": title,
            "price": price,
            "page": page
        })

print("Total records:", len(records))
```

If each page contains 20 records:

```text
5 pages × 20 records = 100 records
```

---

# Task 9 — Basic Rate Limiting

Do not send requests as fast as your computer can generate them.

Use `time.sleep()`:

```python
import time

for page in range(1, 6):

    # Request and process the page

    time.sleep(1)
```

Complete pattern:

```python
import requests
import time

for page in range(1, 6):

    url = (
        "https://books.toscrape.com/"
        f"catalogue/page-{page}.html"
    )

    response = requests.get(
        url,
        timeout=10
    )

    response.raise_for_status()

    print("Downloaded page", page)

    time.sleep(1)
```

There is no universal correct delay. Follow the website's stated rules and avoid unnecessary requests.

---

# Task 10 — Error Handling

Network requests can fail.

```python
import requests

try:

    response = requests.get(
        "https://example.com",
        timeout=10
    )

    response.raise_for_status()

except requests.RequestException as error:

    print("Request failed:")
    print(error)
```

Inside pagination:

```python
for page in range(1, 6):

    try:

        response = requests.get(
            url,
            timeout=10
        )

        response.raise_for_status()

    except requests.RequestException as error:

        print(
            f"Failed on page {page}:",
            error
        )

        continue
```

---
# Task 11 — REST APIs

Web scraping extracts information from HTML intended primarily for human viewing. An **API** provides data in a format intended for programs. Many REST APIs return JSON.

```text
API endpoint → requests.get() → JSON → Python → CSV / JSON
```

For practice, use JSONPlaceholder:

```text
https://jsonplaceholder.typicode.com/posts
```

Create `lab3/api_example.py`:

```python
import requests

url = "https://jsonplaceholder.typicode.com/posts"

response = requests.get(url, timeout=10)
response.raise_for_status()

data = response.json()

print(type(data))
print(len(data))
print(data[0])
```

A record looks similar to:

```python
{
    "userId": 1,
    "id": 1,
    "title": "...",
    "body": "..."
}
```

Unlike HTML scraping, the data is already structured.

---

# Task 12 — Parse and Select JSON Fields

A JSON object resembles a Python dictionary, while a JSON array resembles a Python list.

After:

```python
data = response.json()
```

access values normally:

```python
first_post = data[0]

print(first_post["id"])
print(first_post["title"])
```

Select only fields you need:

```python
records = []

for post in data:

    records.append({
        "id": post["id"],
        "user_id": post["userId"],
        "title": post["title"]
    })
```

Save them:

```python
import pandas as pd

df = pd.DataFrame(records)

df.to_csv(
    "../data/posts.csv",
    index=False
)
```

---

# Task 13 — API Query Parameters

APIs often accept parameters:

```python
params = {
    "userId": 1
}

response = requests.get(
    "https://jsonplaceholder.typicode.com/posts",
    params=params,
    timeout=10
)

response.raise_for_status()

data = response.json()
```

This creates a request similar to:

```text
https://jsonplaceholder.typicode.com/posts?userId=1
```

Real APIs may use parameters such as:

```python
params = {
    "page": 2,
    "limit": 100,
    "category": "science"
}
```

Always follow the documentation of the API you are using.

---

# Task 14 — API Pagination

Many APIs return only a limited number of records per request.

Common patterns include:

```text
?page=1
?page=2
?page=3
```

or:

```text
?limit=100&offset=0
?limit=100&offset=100
?limit=100&offset=200
```

A generic example is:

```python
import requests
import time

all_records = []

for page in range(1, 11):

    params = {
        "page": page,
        "limit": 100
    }

    response = requests.get(
        "https://api.example.com/items",
        params=params,
        timeout=10
    )

    response.raise_for_status()

    page_data = response.json()

    all_records.extend(page_data)

    if len(all_records) >= 1000:
        break

    time.sleep(1)

all_records = all_records[:1000]
```

This is a **generic pattern**. Different APIs use different pagination parameters.

---

# Task 15 — Ethical and Responsible Data Acquisition

Just because a webpage is visible does **not** automatically mean you should scrape it.

## 15.1 Check `robots.txt`

Many websites provide:

```text
https://example.com/robots.txt
```

You can inspect it:

```python
import requests

response = requests.get(
    "https://example.com/robots.txt",
    timeout=10
)

print(response.text)
```

Python also provides a parser:

```python
from urllib.robotparser import RobotFileParser

rp = RobotFileParser()
rp.set_url("https://example.com/robots.txt")
rp.read()

allowed = rp.can_fetch(
    "STATS401-Class-Exercise/1.0",
    "https://example.com/some-page"
)

print("Allowed:", allowed)
```

If automated access is disallowed, choose another source.

## 15.2 Check Terms and API Documentation

A website may prohibit automated collection, limit reuse, require attribution, or provide an official API. Prefer the official API when appropriate.

## 15.3 Avoid Excessive Requests

Use delays and avoid downloading the same pages repeatedly.

```python
time.sleep(1)
```

## 15.4 Do Not Circumvent Restrictions

For this course, do not bypass:

```text
CAPTCHAs
logins
paywalls
rate limits
IP blocks
technical access restrictions
```

## 15.5 Protect Privacy

Avoid collecting sensitive or private personal information.

Good class sources include scraping-practice sites, open government data, public APIs, and websites that clearly permit automated access.

---

# Task 16 — Reusable Scraping Pattern

```python
import requests
import time
import pandas as pd
from bs4 import BeautifulSoup

records = []

for page in range(1, 11):

    url = f"https://example.com/page/{page}"

    try:
        response = requests.get(
            url,
            timeout=10
        )
        response.raise_for_status()

    except requests.RequestException as error:
        print("Request failed:", error)
        continue

    soup = BeautifulSoup(
        response.text,
        "html.parser"
    )

    items = soup.select(".item")

    for item in items:

        title = item.select_one(
            ".title"
        ).get_text(strip=True)

        value = item.select_one(
            ".value"
        ).get_text(strip=True)

        records.append({
            "title": title,
            "value": value
        })

    print(
        f"Collected {len(records)} records"
    )

    time.sleep(1)

df = pd.DataFrame(records)

df.to_csv(
    "../data/scraped_data.csv",
    index=False
)
```

The URL pattern and selectors will differ by website, but this overall structure is common.

---

# Task 17 — Display Acquired Data on Your Lab Website

Your Python acquisition script runs separately from the webpage:

```text
Python script
     ↓
data/lab3_data.csv
     ↓
Lab 3 webpage
     ↓
HTML table
```

Add to `lab3/index.html`:

```html
<h2>Lab 3: Web Data Acquisition</h2>

<p>
    The table below contains data acquired
    using my Python script.
</p>

<table id="data-table">
    <thead></thead>
    <tbody></tbody>
</table>

<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
<script src="lab3.js"></script>
```

Create a table in `lab3.js`:

```javascript
d3.csv("../data/lab3_data.csv")
    .then(data => {

        const columns = data.columns;

        const header = d3.select(
            "#data-table thead"
        )
        .append("tr");

        header.selectAll("th")
            .data(columns)
            .join("th")
            .text(d => d);

        const rows = d3.select(
            "#data-table tbody"
        )
        .selectAll("tr")
        .data(data)
        .join("tr");

        rows.selectAll("td")
            .data(
                row =>
                    columns.map(
                        column => row[column]
                    )
            )
            .join("td")
            .text(d => d);

    });
```

---

# Task 18 — Make the Table Sortable

Users should be able to click a column heading to sort the table.

```javascript
d3.csv("../data/lab3_data.csv")
    .then(data => {

        const columns = data.columns;
        let ascending = true;

        const table = d3.select(
            "#data-table"
        );

        const header = table
            .select("thead")
            .append("tr");

        header.selectAll("th")
            .data(columns)
            .join("th")
            .text(d => d)
            .style("cursor", "pointer")
            .on(
                "click",
                function(event, column) {

                    data.sort(
                        (a, b) =>
                            ascending
                            ? d3.ascending(
                                a[column],
                                b[column]
                              )
                            : d3.descending(
                                a[column],
                                b[column]
                              )
                    );

                    ascending = !ascending;

                    updateRows();
                }
            );

        function updateRows() {

            const rows = table
                .select("tbody")
                .selectAll("tr")
                .data(data);

            rows.join("tr")
                .selectAll("td")
                .data(
                    row =>
                        columns.map(
                            column =>
                                row[column]
                        )
                )
                .join("td")
                .text(d => d);
        }

        updateRows();

    });
```

This simple example treats values as strings. For numeric columns, convert the values to numbers before sorting.

---

# Assignment — Acquire 1,000 Web Records

## Objective

Write a **Python data-acquisition script** that collects **at least 1,000 records/items** from an appropriate web-accessible data source. Then display the resulting dataset as a **sortable table** on your Lab 3 GitHub Pages webpage.

```text
Web page
       ↓
Python script
       ↓
At least 1,000 records
       ↓
CSV / JSON
       ↓
Lab 3 webpage
       ↓
Sortable table
       ↓
GitHub Pages
```

Your source must permit the type of automated access you perform.

---

# Assignment Requirements

## 1. Collect at Least 1,000 Items

Your final dataset must contain at least:

```text
1,000 records
```

Each row should represent one item or observation.

Choose a source that can reasonably provide 1,000 records without aggressive requesting.

## 2. Use a Python Script

The data must be acquired programmatically using Python. Do not manually copy records into a CSV file.

## 3. Include Multiple Attributes

Each record should contain at least **three useful attributes/columns**, in addition to an identifier when possible.

Examples:

```text
title, category, price, rating
```

or:

```text
id, date, location, value
```

## 4. Handle Pagination Automatically

If the source divides data across pages or API requests, use a loop.

Example:

```python
for page in range(1, 51):
    # request and process page
```

Do not manually run a separate script for every page.

## 5. Include Basic Rate Limiting

When making repeated requests, include a reasonable delay when appropriate:

```python
time.sleep(1)
```

## 6. Include Basic Error Handling

Use a reasonable error-handling strategy such as:

```python
try:
    ...
except requests.RequestException as error:
    ...
```

## 7. Save the Dataset

Save your result as CSV or JSON.

Example:

```python
df.to_csv(
    "../data/lab3_data.csv",
    index=False
)
```

## 8. Describe the Dataset on the Lab 3 Page

Clearly state:

- what the dataset contains;
- the data source;
- whether you used HTML scraping or an API;
- the number of records collected.

Example:

```text
Dataset: Public Book Records
Source: [source name]
Method: HTML scraping with requests + BeautifulSoup
Records collected: 1,000
```

## 9. Display a Table

Display the acquired records as an HTML table on the Lab 3 page.

## 10. Make the Table Sortable

Users must be able to click column headings to sort the table.

At minimum:

```text
Click heading → ascending
Click again   → descending
```

## 11. Publish Through GitHub Pages

Your page should be publicly accessible at a URL similar to:

```text
https://yourusername.github.io/stats401-labs/lab3/
```

Make sure the CSV/JSON file is committed to the repository.

---

# Responsible Data Acquisition Requirement

Before selecting a source:

1. Check whether automated access is allowed.
2. Review terms of service or API documentation.
3. Do not bypass authentication, CAPTCHAs, paywalls, rate limits, or technical restrictions.
4. Avoid sensitive or private personal data.
5. Avoid excessive server requests.

If a source does not permit automated collection, **choose another source**.

---

# What to Include on Your Lab 3 Page

```text
Lab 3: Web Data Acquisition

Dataset description
Data source
Number of records
```

---

# What to Submit

Submit **one GitHub Pages link** that directly opens your Lab 3 assignment.

Example:

```text
https://yourusername.github.io/stats401-labs/lab3/
```

Your Python acquisition script and scraped dataset must also be included in your GitHub repository.

---

# Submission Checklist

- [ ] My final dataset contains at least 1,000 records.
- [ ] Each record contains at least 3 useful attributes.
- [ ] My script includes reasonable rate limiting for repeated requests.
- [ ] My script includes basic error handling.
- [ ] I saved the acquired data as CSV or JSON.
- [ ] My Lab 3 webpage loads the acquired dataset.
- [ ] My webpage explains the source and acquisition method.
- [ ] My webpage displays the data in a table.
- [ ] My table is sortable by clicking column headings.

---
