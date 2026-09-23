# Lab 8 --- Web Text Data and Visualization: Exploring a Large Bulletin

**STATS 401: Data Acquisition and Visualization**

## Learning Objectives

By the end of this lab, you should be able to:

1.  Structure a long web/PDF document as meaningful text passages.
2.  Preserve chapter, section, subsection, page, and passage metadata.
3.  Use corpus statistics and TF-IDF to understand text.
4.  Generate semantic embeddings and calculate semantic similarity.
5.  Use UMAP to project high-dimensional embeddings into 2D.
6.  Cluster and interpret semantic topics.
7.  Create an interactive semantic embedding map with D3.
8.  Create a **Topic × Bulletin Section matrix**.
9.  Coordinate search, filtering, highlighting, zoom, and
    details-on-demand.
10. Compare a document's **formal structure** with its **semantic
    structure**.

------------------------------------------------------------------------

# 0. Why Visualize a 400-Page Bulletin?

A university bulletin contains hundreds of pages covering academic
policies, degree requirements, majors, courses, registration,
graduation, academic integrity, study away, transfer credits, and
student support.

Keyword search is useful, but it does not easily answer:

``` text
What are the major themes?
Which topics occur across multiple chapters?
Which passages from different sections discuss similar ideas?
Where does "credit" occur across different contexts?
Which sections contain semantically diverse content?
Are some passages unusual for the section in which they appear?
```

We therefore treat the bulletin as:

``` text
Formal document structure
          +
Semantic information space
```

The final system contains two coordinated views:

``` text
View 1: Semantic Embedding Map
View 2: Topic × Bulletin Section Matrix
```

------------------------------------------------------------------------

# 1. Overall Pipeline

``` text
400-page Bulletin
        ↓
Extract Text
        ↓
Chapter / Section / Subsection
        ↓
Paragraph / Policy Block
        ↓
Clean + Structure
        ↓
Basic Text Analysis
        ↓
Semantic Embeddings
        ↓
Clustering + UMAP
        ↓
┌───────────────────┬────────────────────┐
│ Semantic Map      │ Topic × Section    │
│                   │ Matrix             │
└───────────────────┴────────────────────┘
        ↓
Search + Filter + Coordinated Highlighting
```

------------------------------------------------------------------------

# Task 1 --- Choose the Unit of Analysis

Use:

> **One paragraph or short policy block = one document unit = one
> point**

Avoid using a single word, an entire page, or a whole chapter as one
unit. Each passage should contain enough context to be interpreted
independently.

------------------------------------------------------------------------

# Task 2 --- Preserve Document Structure

Create a table such as:

``` text
passage_id
chapter
section
subsection
page
text
```

Example:

``` csv
passage_id,chapter,section,subsection,page,text
p001,Academic Policies,Registration,Add Drop,25,"Students may..."
p002,Academic Policies,Graduation,Degree Requirements,41,"Students must..."
```

This lets us compare:

``` text
WHERE the passage appears
            vs.
WHAT the passage means
```

------------------------------------------------------------------------

# Task 3 --- Clean the Corpus

``` python
import pandas as pd

df = pd.read_csv("../data/bulletin_passages.csv")

df = df.dropna(subset=["text"])
df = df.drop_duplicates(subset=["text"])

df["text_clean"] = (
    df["text"]
    .str.replace(r"\s+", " ", regex=True)
    .str.strip()
)
```

For PDF extraction, also inspect and remove repeated headers/footers,
standalone page numbers, table-of-contents artifacts, and broken
passages.

Do not aggressively remove stop words or lemmatize before semantic
embedding.

------------------------------------------------------------------------

# Task 4 --- Basic Corpus Analysis

Passage length:

``` python
df["word_count"] = (
    df["text_clean"]
    .str.split()
    .str.len()
)

print(df["word_count"].describe())
```

Passages by section:

``` python
print(
    df["section"].value_counts()
)
```

You can also calculate frequent meaningful terms or TF-IDF terms. These
summaries provide an overview before more complex semantic modeling.

------------------------------------------------------------------------

# Task 5 --- TF-IDF vs. Semantic Embeddings

``` text
TF-IDF
→ Which terms characterize documents?

Semantic embeddings
→ Which documents have similar meanings?
```

In this lab:

``` text
Semantic embeddings → organize passages
TF-IDF             → help interpret clusters
```

------------------------------------------------------------------------

# Task 6 --- Generate Semantic Embeddings

Install:

``` bash
pip install sentence-transformers umap-learn scikit-learn pandas
```

Generate embeddings:

``` python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)

embeddings = model.encode(
    df["text_clean"].tolist(),
    normalize_embeddings=True
)

print(embeddings.shape)
```

Conceptually:

``` text
Passage
   ↓
Language Model
   ↓
High-dimensional Semantic Vector
```

------------------------------------------------------------------------

# Task 7 --- Semantic Similarity

``` python
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

similarity = cosine_similarity(embeddings)

scores = similarity[0].copy()
scores[0] = -1

index = np.argmax(scores)

print(df.iloc[0]["text"])
print(df.iloc[index]["text"])
print("Similarity:", scores[index])
```

This later supports:

``` text
Click Passage
      ↓
Show Nearest Semantic Passages
```

------------------------------------------------------------------------

# Task 8 --- UMAP Projection

``` python
import umap

reducer = umap.UMAP(
    n_components=2,
    n_neighbors=15,
    min_dist=0.15,
    metric="cosine",
    random_state=401
)

coords = reducer.fit_transform(
    embeddings
)

df["x"] = coords[:, 0]
df["y"] = coords[:, 1]
```

**Do not interpret the UMAP x- and y-axes as independent semantic
variables.**

Interpret primarily:

``` text
Nearby passages
→ tend to be semantically similar
```

The 2D map is an approximation of the original high-dimensional semantic
space.

------------------------------------------------------------------------

# Task 9 --- Cluster and Label Semantic Topics

``` python
from sklearn.cluster import KMeans

kmeans = KMeans(
    n_clusters=8,
    random_state=401,
    n_init="auto"
)

df["cluster"] = (
    kmeans.fit_predict(embeddings)
)
```

Inspect passages from each cluster before assigning a topic label:

``` python
for c in sorted(df["cluster"].unique()):

    print("\nCLUSTER", c)

    subset = df[
        df["cluster"] == c
    ]

    for text in subset[
        "text_clean"
    ].head(10):

        print("-", text)
```

Use representative passages plus TF-IDF terms to create meaningful
labels such as `Registration`, `Degree Requirements`, or `Study Away`.
These are examples only; labels should emerge from the actual corpus.

------------------------------------------------------------------------

# Task 10 --- Export Visualization-Ready Data

Preserve both formal and semantic information:

``` text
passage_id
chapter
section
subsection
page
text
word_count
cluster
cluster_name
x
y
```

``` python
df.to_csv(
    "../data/lab8_embedding_map.csv",
    index=False
)
```

------------------------------------------------------------------------

# Task 11 --- View 1: Semantic Embedding Map

Load:

``` javascript
d3.csv(
    "../data/lab8_embedding_map.csv",
    d => ({
        ...d,
        x: +d.x,
        y: +d.y,
        word_count: +d.word_count,
        cluster: +d.cluster
    })
)
.then(data => {
    drawSemanticMap(data);
});
```

Create scales:

``` javascript
const xScale = d3.scaleLinear()
    .domain(d3.extent(data, d => d.x))
    .range([50, 850]);

const yScale = d3.scaleLinear()
    .domain(d3.extent(data, d => d.y))
    .range([600, 50]);
```

Draw one point per passage:

``` javascript
const points = svg
    .selectAll(".passage")
    .data(data)
    .join("circle")
    .attr("class", "passage")
    .attr("cx", d => xScale(d.x))
    .attr("cy", d => yScale(d.y))
    .attr("r", 5);
```

A possible encoding is:

``` text
position → semantic embedding
color    → semantic topic
size     → passage length
stroke   → original bulletin section
```

Do not overload the map; choose channels that support your analytical
questions.

------------------------------------------------------------------------

# Task 12 --- Details, Search, and Filtering

When a point is clicked, show a persistent detail panel containing:

``` text
Chapter
Section
Subsection
Page
Semantic Topic
Original Passage
```

Example:

``` javascript
points.on("click", function(event, d) {

    d3.select("#detail-panel")
        .html(`
            <h3>${d.section}</h3>
            <p>Topic: ${d.cluster_name}</p>
            <p>Page: ${d.page}</p>
            <p>${d.text}</p>
        `);
});
```

Add search:

``` html
<input
    type="text"
    id="search"
    placeholder="Search bulletin...">
```

``` javascript
d3.select("#search")
    .on("input", function() {

        const query =
            this.value.toLowerCase().trim();

        points.attr(
            "opacity",
            d =>
                query === ""
                ||
                d.text.toLowerCase()
                    .includes(query)
                ? 1
                : 0.08
        );
    });
```

Also provide filters for:

``` text
Formal Section
Semantic Topic
```

and zoom/pan using `d3.zoom()`.

------------------------------------------------------------------------

# Task 13 --- Nearest Semantic Neighbors

A useful interaction is:

``` text
Select one passage
        ↓
Highlight selected passage
        ↓
Highlight 5 most semantically similar passages
        ↓
Show their sections and text
```

This is particularly useful for discovering passages in **different
formal sections** that discuss related concepts.

------------------------------------------------------------------------

# Task 14 --- View 2: Topic × Bulletin Section Matrix

The semantic map is good for neighborhoods, but less effective for
summarizing how topics are distributed across the bulletin's formal
structure.

Create:

``` text
Rows    → formal bulletin sections
Columns → semantic topics
Cells   → number or proportion of passages
```

Prepare:

``` python
matrix_df = (
    df
    .groupby(
        ["section", "cluster_name"]
    )
    .size()
    .reset_index(name="count")
)

matrix_df.to_csv(
    "../data/lab8_topic_section_matrix.csv",
    index=False
)
```

Conceptually:

``` text
                    Semantic Topic
                 Credit  Reg.  Integrity  Graduation
Academic Policy    ███   ████     ███        ██
Majors             ███    █        ·        ███
Study Away          ██    █        ·         ██
Student Support      ·    █       ██          ·
```

A darker cell can represent more passages.

------------------------------------------------------------------------

# Task 15 --- Coordinate the Two Views

The views should not behave as independent charts.

For example:

``` text
Click Matrix Cell
      ↓
Section = Study Away
Topic = Credit
      ↓
Highlight Corresponding Passages
in Semantic Map
```

Or:

``` text
Select Semantic Point
      ↓
Highlight its Topic × Section Cell
```

The complete interface becomes:

``` text
Semantic Map
     ↕
Topic × Section Matrix
     ↕
Detail Panel
```

------------------------------------------------------------------------

# Assignment --- Interactive Visual Exploration of the DKU Undergraduate Bulletin

## Objective

Design an interactive visual exploration system for the approximately
400-page **Bulletin of Duke Kunshan University Undergraduate
Instruction**.

https://dku-web-admissions.s3.cn-north-1.amazonaws.com.cn/dkumain/files/V2021-22_DKU_UG_Bulletin.pdf

Your system must connect:

``` text
Formal Document Structure
          ↕
Semantic Structure
```

rather than simply displaying a UMAP scatterplot.

## Part A --- Corpus Preparation

Use the bulletin provided by the instructor/course or an official DKU
source. Record its title, academic year/version, source, and date
accessed.

Split it into meaningful paragraphs or short policy blocks and preserve:

``` text
chapter
section
subsection
page
text
```

Report the number of raw passages, number after cleaning, average
passage length, and number of formal sections.

## Part B --- Basic Text Overview

Provide at least **two corpus-level summaries**, such as:

``` text
Top meaningful terms
Passages by section
Average passage length by section
Top TF-IDF terms
```

These may be simple D3 charts or tables.

## Part C --- Semantic Analysis

For each passage:

1.  Generate a semantic embedding.
2.  Reduce embeddings to 2D with UMAP.
3.  Cluster the original embedding vectors.
4.  Inspect representative passages and characteristic terms.
5.  Give each cluster a meaningful topic label.

Document the embedding model, UMAP settings, clustering method, and
number of clusters.

## Part D --- Required View 1: Semantic Embedding Map

Create an interactive semantic map where:

``` text
one point → one passage
position  → semantic embedding
color     → semantic topic
```

Encode at least one additional useful attribute.

Required interactions:

``` text
Click → passage details
Search → highlight matching passages
Topic filter
Section filter
Zoom / pan
Nearest semantic neighbors
```

## Part E --- Required View 2: Topic × Section Matrix

Create:

``` text
Rows    → formal bulletin sections
Columns → semantic topics
Cells   → number or proportion of passages
```

Include tooltips showing section, topic, and passage count/proportion.

## Part F --- Coordinate the Views

Implement at least one coordinated interaction, for example:

``` text
Click matrix cell
→ highlight corresponding semantic-map passages
```

or:

``` text
Select semantic point
→ highlight its matrix cell
```

## Part G --- Analyze the Bulletin

Use your system to answer at least **four** questions:

1.  What are the major semantic topics?
2.  Which topics appear across multiple formal sections?
3.  Which formal sections contain the most semantically diverse content?
4.  Which passages from different sections are semantically similar?
5.  Which passages appear unusual relative to their formal section?
6.  Search for `credit`, `graduation`, `registration`, or
    `academic integrity`. Does the concept occur in one semantic region
    or across several topics?

Your answers should be based on the visualization and underlying
passages or paragraphs.

## Part H --- Design Description and Findings

Write approximately **200--300 words** explaining:

1.  how embeddings and UMAP were produced;
2.  how topics were generated and labeled;
3.  your visual encodings;
4.  how coordinated interaction supports exploration;

------------------------------------------------------------------------

# Assignment Requirements

1.  Use the DKU Undergraduate Instruction Bulletin.
2.  Document the bulletin version/source.
3.  Divide it into meaningful passages.
4.  Preserve document hierarchy metadata.
5.  Clean duplicated/malformed text.
6.  Provide at least two corpus summaries.
7.  Generate semantic embeddings.
8.  Use UMAP or another justified projection method.
9.  Cluster and meaningfully label semantic topics.
10. Create a D3 semantic embedding map.
11. Create a Topic × Section matrix.
12. Encode at least one additional passage attribute.
13. Include passage details, search, section/topic filtering, and zoom.
14. Support nearest-semantic-neighbor exploration.
15. Coordinate the two views.
16. Include legends and clear titles.
17. Answer analytical questions.
18. Include a 200--300 word design description and findings.


------------------------------------------------------------------------

# Suggested Page Structure

``` text
Lab 8: Web Text Data and Visualization

1. Bulletin / Corpus Description

2. Corpus Overview
   [statistics + simple charts]

3. Semantic Embedding Map
   [search] [section filter] [topic filter]
   [interactive map]
   [detail panel]

4. Topic × Bulletin Section Matrix
   [interactive matrix]

5. Semantic Findings

6. Design Description
```

------------------------------------------------------------------------

# Submission Checklist

-   [ ] I create meaningful passage units.
-   [ ] I preserve chapter/section/subsection metadata.
-   [ ] I clean the corpus.
-   [ ] I provide at least two corpus summaries.
-   [ ] I generate semantic embeddings.
-   [ ] I document the embedding model.
-   [ ] I use and document dimensionality reduction.
-   [ ] I cluster and meaningfully label topics.
-   [ ] I create the semantic embedding map.
-   [ ] I create the Topic × Section matrix.
-   [ ] My semantic map includes passage details, text search, section/topic filters.
-   [ ] My semantic map supports zoom/pan.
-   [ ] I support nearest-neighbor exploration.
-   [ ] The two views have at least one coordinated interaction.
-   [ ] I provide appropriate legends/titles.
-   [ ] I answer at least four analytical questions.
-   [ ] I include a 200--300 word design description and findings.
