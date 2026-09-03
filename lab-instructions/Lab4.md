# Lab 4 — Cleaning Web Data for Visualization

**STATS 401: Data Acquisition and Visualization**

## Learning Objectives

By the end of this lab, you should be able to:

1. Identify missing values, duplicates, incorrect types, inconsistent categories, and malformed strings.
2. Clean and standardize web data with `pandas`.
3. Preprocess tweet text using normalization, tokenization, stop-word removal, and lemmatization.
4. Prune a vocabulary and create a Document-Term Matrix (DTM).
5. Compute TF-IDF to identify terms that are important within individual tweets.
6. Use a RoBERTa-based Transformer to estimate tweet sentiment.
7. Transform raw tweets into tidy, visualization-ready data for D3.

---

# 0. Workflow

```text
Raw web data → inspect → clean structured fields

Text analysis path A:
preprocess text → DTM → TF-IDF → term-level analysis

Text analysis path B:
lightly normalize original text → RoBERTa sentiment analysis

```

Use the provided 50-row file:

```text
data/lab4_dirty_tweets.csv
```

It deliberately contains missing values, duplicates, mixed dates, incorrect numeric values, inconsistent categories, malformed strings, URLs, mentions, hashtags, numbers, emoji, and tweet-like text.

---

# Task 1 — Inspect the Raw Data

```python
import pandas as pd

df = pd.read_csv("../data/lab4_dirty_tweets.csv")

print(df.head())
print(df.shape)
print(df.info())
print(df.describe(include="all"))
```

Columns: `tweet_id`, `created_at`, `username`, `sentiment_raw`, `platform`, `tweet_text`, `likes`, `retweets`, and `country`.

Ask: Which fields are missing? Which rows are duplicated? Which columns have incorrect types? Which categories represent the same concept? Which values are impossible?

---

# Task 2 — Missing Values

```python
print(df.isna().sum())
print(df[df.isna().any(axis=1)])
```

A missing tweet is critical for text analysis:

```python
df = df.dropna(subset=["tweet_text"])
```

A missing retweet count may be treated differently:

```python
df["retweets"] = df["retweets"].fillna(0)
```

Do not automatically replace every missing value with zero; consider what the variable means.

---

# Task 3 — Duplicates

```python
print(df.duplicated().sum())
print(df[df.duplicated(keep=False)])

df = df.drop_duplicates()
```

Check duplicate tweet IDs:

```python
print(
    df[df.duplicated(
        subset=["tweet_id"],
        keep=False
    )]
)

df = df.drop_duplicates(
    subset=["tweet_id"],
    keep="first"
)
```

---

# Task 4 — Incorrect Data Types

The raw data contains values such as `124`, `unknown`, `1,200`, and `-5`.

```python
df["likes"] = (
    df["likes"].astype(str)
    .str.replace(",", "", regex=False)
)

df["likes"] = pd.to_numeric(
    df["likes"], errors="coerce"
)

df["retweets"] = pd.to_numeric(
    df["retweets"], errors="coerce"
)

df.loc[df["retweets"] < 0, "retweets"] = pd.NA
```

One possible treatment:

```python
df["likes"] = df["likes"].fillna(
    df["likes"].median()
)

df["retweets"] = df["retweets"].fillna(0)
```

Always document your choice.

---

# Task 5 — Parse Dates

```python
df["created_at"] = pd.to_datetime(
    df["created_at"],
    errors="coerce",
    format="mixed"
)

print(df[df["created_at"].isna()])
```

If time is required:

```python
df = df.dropna(subset=["created_at"])
```

Create useful attributes:

```python
df["date"] = df["created_at"].dt.date
df["hour"] = df["created_at"].dt.hour
df["weekday"] = df["created_at"].dt.day_name()
```

---

# Task 6 — Standardize Categories and Strings

```python
df["platform"] = (
    df["platform"].astype("string")
    .str.strip()
    .str.lower()
)

platform_map = {
    "web": "Web",
    "mobile": "Mobile",
    "ios": "iOS",
    "android": "Android"
}

df["platform"] = df["platform"].map(platform_map)
```

Standardize countries:

```python
country_map = {
    "US": "United States",
    "USA": "United States",
    "United States": "United States",
    "us": "United States",
    "U.S.": "United States",
    "UK": "United Kingdom",
    "uk": "United Kingdom",
    "United Kingdom": "United Kingdom",
    "Canada": "Canada",
    "CA": "Canada"
}

df["country"] = df["country"].map(country_map)
```

Clean usernames and whitespace:

```python
df["username"] = (
    df["username"].astype("string")
    .str.strip()
    .str.replace(r"^@", "", regex=True)
    .str.lower()
)

df["tweet_text"] = (
    df["tweet_text"].astype("string")
    .str.replace(r"\s+", " ", regex=True)
    .str.strip()
)

df["tweet_text_raw"] = df["tweet_text"]
```

Standardize the deliberately inconsistent supplied labels:

```python
df["sentiment_raw"] = (
    df["sentiment_raw"].astype("string")
    .str.strip()
    .str.lower()
)

sentiment_map = {
    "positive": "Positive",
    "pos": "Positive",
    "negative": "Negative",
    "neg": "Negative",
    "neutral": "Neutral"
}

df["sentiment_clean"] = (
    df["sentiment_raw"].map(sentiment_map)
)
```

These labels are included for cleaning practice. Later we calculate sentiment directly from tweet text.

---

# Part A — TF-IDF
TF-IDF is a text-analysis technique used to measure how important each word is to a tweet relative to the entire collection of tweets.

# Task 7 — Tweet Preprocessing

Before text analysis:

1. **Normalization** — normalize URLs, usernames, and numbers.
2. **Tokenization** — break tweets into words.
3. **Stop-word removal** — remove common words such as `the`, `to`, and `my`.
4. **Lemmatization** — reduce words toward meaningful base forms.

Install:

```bash
pip install nltk scikit-learn transformers torch
```

Download once:

```python
import nltk

nltk.download("punkt")
nltk.download("punkt_tab")
nltk.download("stopwords")
nltk.download("wordnet")
nltk.download("omw-1.4")
```

## 7.1 Normalization

```python
import re

def normalize_tweet(text):
    text = text.lower()
    text = re.sub(
        r"https?://\S+|www\.\S+",
        " URL ", text
    )
    text = re.sub(r"@\w+", " USER ", text)
    text = re.sub(
        r"\b\d+(?:\.\d+)?\b",
        " NUMBER ", text
    )
    text = re.sub(r"\s+", " ", text)
    return text.strip()

df["text_normalized"] = (
    df["tweet_text"].apply(normalize_tweet)
)
```

Example:

```text
Great work @team! Version 2.0 https://example.com
↓
great work USER! version NUMBER URL
```

## 7.2 Tokenization

```python
from nltk.tokenize import word_tokenize

df["tokens"] = (
    df["text_normalized"].apply(word_tokenize)
)
```

## 7.3 Stop-Word Removal

```python
from nltk.corpus import stopwords

stop_words = set(stopwords.words("english"))

def remove_stopwords(tokens):
    return [
        token for token in tokens
        if token not in stop_words
    ]

df["tokens_no_stop"] = (
    df["tokens"].apply(remove_stopwords)
)
```

## 7.4 Lemmatization

```python
from nltk.stem import WordNetLemmatizer

lemmatizer = WordNetLemmatizer()

def lemmatize_tokens(tokens):
    return [
        lemmatizer.lemmatize(token)
        for token in tokens
        if token.isalpha()
    ]

df["tokens_clean"] = (
    df["tokens_no_stop"].apply(lemmatize_tokens)
)

df["text_clean"] = (
    df["tokens_clean"].apply(" ".join)
)
```

Compare:

```python
print(
    df[["tweet_text_raw", "text_clean"]]
    .head()
)
```

---

# Task 8 — Prune the Vocabulary

Very rare words may add noise, while words appearing in nearly every tweet may add little discrimination.

```python
from sklearn.feature_extraction.text import CountVectorizer

vectorizer = CountVectorizer(
    min_df=2,
    max_df=0.90,
    lowercase=True
)

dtm = vectorizer.fit_transform(
    df["text_clean"]
)

terms = vectorizer.get_feature_names_out()

print(terms)
print("Vocabulary size:", len(terms))
```

Here:

```text
min_df=2   → keep terms appearing in at least 2 documents
max_df=.90 → remove terms appearing in more than 90% of documents
```

---

# Task 9 — Create a Document-Term Matrix (DTM)

A **Document-Term Matrix** describes the frequency of terms in a collection of documents.

```text
Rows    → tweets
Columns → terms
Values  → term counts
```

Conceptually:

| Tweet | dashboard | update | crash | useful |
|---|---:|---:|---:|---:|
| Tweet 1 | 1 | 0 | 0 | 1 |
| Tweet 2 | 0 | 1 | 1 | 0 |
| Tweet 3 | 0 | 1 | 0 | 0 |

Inspect the matrix:

```python
print(dtm.shape)

dtm_df = pd.DataFrame(
    dtm.toarray(),
    columns=vectorizer.get_feature_names_out()
)

print(dtm_df.head())
```

For large datasets, keep the sparse matrix rather than converting the entire matrix to a dense DataFrame.

---

# Task 10 — TF-IDF

TF-IDF consists of two ideas:

```text
TF  = term frequency within a tweet
IDF = inverse document frequency across tweets
```

A higher TF-IDF value means a term is relatively important to a particular tweet.

```python
from sklearn.feature_extraction.text import TfidfVectorizer

tfidf_vectorizer = TfidfVectorizer(
    min_df=2,
    max_df=0.90
)

tfidf = tfidf_vectorizer.fit_transform(
    df["text_clean"]
)

print(tfidf.shape)
print(
    tfidf_vectorizer.get_feature_names_out()
)
```

Inspect a small table:

```python
tfidf_df = pd.DataFrame(
    tfidf.toarray(),
    columns=(
        tfidf_vectorizer
        .get_feature_names_out()
    )
)

print(tfidf_df.head())
```

At this point, each tweet has a vector of TF-IDF scores. These scores can be used to identify characteristic terms, inspect vocabulary patterns, or create text-oriented visualizations.

This completes the **TF-IDF analysis** portion of the lab.

---

# Part B — Sentiment Analysis

Sentiment analysis is a separate text-analysis task. Its purpose here is to estimate whether each tweet expresses **negative, neutral, or positive sentiment**.

# Task 11 — Transformer-Based Sentiment Analysis with RoBERTa

We will use a Transformer model that analyzes a tweet in context and estimates its sentiment.

In this lab, we use a **RoBERTa-based sentiment model**:

```text
Tweet
  ↓
Tokenizer
  ↓
RoBERTa
  ↓
Contextual language representation
  ↓
Sentiment probabilities
  ↓
Negative / Neutral / Positive
```

## 11.1 What Is RoBERTa?

**RoBERTa** stands for **Robustly Optimized BERT Pretraining Approach**. It is a Transformer language model based on the BERT architecture.

RoBERTa creates **contextual representations** of language. The representation of a word depends on the words around it.

For example:

```text
I like this movie.
I do not like this movie.
```

The two sentences contain many of the same words, but their meanings are different. A Transformer is designed to model relationships among words and can better capture patterns such as negation and context.

Another example:

```text
I expected this to be terrible, but it was actually amazing.
```

A simple word-count approach sees both `terrible` and `amazing`. A Transformer attempts to interpret their roles in the complete sentence.

## 11.2 Pretrained RoBERTa vs. a Sentiment Model

The model `roberta-base` is a **pretrained language model**, but it has not by itself been fine-tuned to output sentiment labels.

For sentiment analysis, we use a RoBERTa-based model that has been fine-tuned for sentiment classification on social-media text:

```text
cardiffnlp/twitter-roberta-base-sentiment-latest
```

This allows us to use a modern NLP model without training our own classifier in this lab.

## 11.3 Load the Model

```python
from transformers import pipeline

sentiment_model = pipeline(
    "sentiment-analysis",
    model=(
        "cardiffnlp/"
        "twitter-roberta-base-sentiment-latest"
    ),
    top_k=None
)
```

The first run downloads the model, so it may take some time.

## 11.4 Test One Tweet

```python
test_tweet = "I absolutely love this new update!"

result = sentiment_model(test_tweet)
print(result)
```

The model returns scores for sentiment classes such as:

```text
negative
neutral
positive
```

These scores can be interpreted as the model's estimated probabilities for the three sentiment classes.

## 11.5 Sentiment Output

For each tweet, the model estimates probabilities for three sentiment classes:

```text
negative
neutral
positive
```

We can use these probabilities to derive a predicted sentiment label and, if useful for visualization, a continuous sentiment score.

---

# Task 12 — Apply RoBERTa Sentiment Analysis to the Tweets

For sentiment analysis, keep more of the original language than we used for TF-IDF. Punctuation, emoji, capitalization, and negation may contain useful sentiment information.

Start from `tweet_text_raw` rather than the aggressively preprocessed `text_clean` column.

## 12.1 Lightly Normalize Social-Media Text

We can normalize usernames and URLs while preserving the rest of the tweet:

```python
import re

def prepare_for_roberta(text):
    text = str(text)
    text = re.sub(r"@\w+", "@user", text)
    text = re.sub(
        r"https?://\S+|www\.\S+",
        "http",
        text
    )
    return text.strip()


df["sentiment_text"] = (
    df["tweet_text_raw"]
    .fillna("")
    .apply(prepare_for_roberta)
)
```

Notice that this preprocessing is intentionally lighter than the preprocessing used for TF-IDF.

## 12.2 Analyze All Tweets

```python
results = sentiment_model(
    df["sentiment_text"].tolist(),
    truncation=True,
    batch_size=16
)
```

Each tweet now has three class scores.

## 12.3 Extract the Sentiment Label

Create a helper function:

```python
def scores_to_dict(scores):
    return {
        item["label"].lower(): item["score"]
        for item in scores
    }
```

Convert the model output into separate columns:

```python
score_dicts = [
    scores_to_dict(scores)
    for scores in results
]


df["sentiment_negative"] = [
    scores.get("negative", 0)
    for scores in score_dicts
]

df["sentiment_neutral"] = [
    scores.get("neutral", 0)
    for scores in score_dicts
]

df["sentiment_positive"] = [
    scores.get("positive", 0)
    for scores in score_dicts
]
```

Choose the class with the highest score:

```python
def predicted_label(scores):
    return max(
        scores,
        key=scores.get
    ).capitalize()


df["sentiment"] = [
    predicted_label(scores)
    for scores in score_dicts
]
```

Inspect the results:

```python
print(
    df[[
        "tweet_text_raw",
        "sentiment_negative",
        "sentiment_neutral",
        "sentiment_positive",
        "sentiment"
    ]].head()
)
```

## 12.4 Create a Numeric Sentiment Score

For visualization, it is sometimes useful to have a single numeric score in addition to the categorical label.

We can define:

```text
sentiment_score = P(positive) - P(negative)
```

This produces a value approximately between `-1` and `1`:

```text
closer to -1 → more negative
around 0     → neutral / uncertain
closer to 1  → more positive
```

Calculate it:

```python
df["sentiment_score"] = (
    df["sentiment_positive"]
    - df["sentiment_negative"]
)
```

Now inspect both the categorical and continuous representations:

```python
print(
    df[[
        "tweet_text_raw",
        "sentiment",
        "sentiment_score"
    ]].head()
)
```

## 12.5 Important Limitation

Transformer predictions should **not be treated as ground truth**. RoBERTa can still make mistakes with:

- sarcasm;
- irony;
- unusual slang;
- ambiguous language;
- domain-specific expressions;
- cultural context.

For example:

```text
Great. Another software crash.
```

The literal word `Great` is positive, but the intended sentiment may be negative.

Therefore, the sentiment variables generated in this lab should be interpreted as **model-generated estimates**, not objectively correct labels.

## 12.6 The Complete Text-Analysis Pipeline

We now have two complementary branches:

```text
                         ┌→ DTM / TF-IDF
                         │      ↓
Raw tweets → cleaning ───┤   word importance
                         │
                         └→ RoBERTa
                                ↓
                         sentiment estimates
                                ↓
                      visualization-ready data
```

This is an important data-science pattern: raw text can be transformed into multiple derived variables that support different visualization questions.

---

# Task 13 — Create Tidy Visualization-Ready Data

Keep useful original variables plus derived variables:

```python
vis_df = df[[
    "tweet_id",
    "created_at",
    "date",
    "hour",
    "weekday",
    "username",
    "platform",
    "country",
    "tweet_text_raw",
    "text_clean",
    "likes",
    "retweets",
    "sentiment_score",
    "sentiment"
]].copy()
```

Validate:

```python
print(vis_df.head())
print(vis_df.info())
print(vis_df.isna().sum())
print(vis_df["sentiment"].value_counts())
```

Export:

```python
vis_df.to_csv(
    "../data/lab4_clean_tweets.csv",
    index=False
)
```

The pipeline is now:

```text
messy tweets
   ↓
clean + preprocess
   ↓
derive sentiment
   ↓
tidy rows and columns
   ↓
lab4_clean_tweets.csv
   ↓
D3
```

---

# Task 14 — Aggregate Data for Visualization

Sentiment counts:

```python
sentiment_counts = (
    vis_df["sentiment"]
    .value_counts()
    .rename_axis("sentiment")
    .reset_index(name="count")
)

sentiment_counts.to_csv(
    "../data/sentiment_counts.csv",
    index=False
)
```

Sentiment by platform:

```python
sentiment_platform = (
    vis_df
    .groupby(
        ["platform", "sentiment"]
    )
    .size()
    .reset_index(name="count")
)

sentiment_platform.to_csv(
    "../data/sentiment_by_platform.csv",
    index=False
)
```

Average sentiment by weekday:

```python
sentiment_time = (
    vis_df
    .groupby("weekday")[
        "sentiment_score"
    ]
    .mean()
    .reset_index()
)

sentiment_time.to_csv(
    "../data/sentiment_by_weekday.csv",
    index=False
)
```

This demonstrates an important distinction:

```text
Raw data
→ one row per tweet

Visualization-ready aggregate
→ one row per category / time unit / group
```

---

# Task 15 — Load Cleaned Data in D3

Your Lab 4 page can load the processed CSV:

```javascript
d3.csv(
    "../data/lab4_clean_tweets.csv",
    d => ({
        ...d,
        likes: +d.likes,
        retweets: +d.retweets,
        sentiment_score:
            +d.sentiment_score
    })
)
.then(data => {

    console.log(data);

});
```

You can now visualize sentiment together with another attribute such as platform, time, likes, or retweets.

---

# Assignment — Clean and Visualize 1,000 Tweets

## Objective

Find a tweet/X dataset containing **at least 1,000 tweets**, clean and preprocess it using the techniques introduced in this lab, perform sentiment analysis, and create a D3 visualization combining **tweet sentiment with at least one other tweet attribute**.

```text
Raw tweet dataset (≥1,000)
        ↓
Inspect
        ↓
Clean structured fields
        ↓
Sentiment analysis
        ↓
Tidy visualization-ready data
        ↓
D3 visualization
```

## Dataset Requirement

Find a raw tweet/X dataset containing at least **1,000 records** and a tweet text/content field.

Prefer a dataset that contains raw tweet content and other attributes rather than a dataset whose main purpose is to provide precomputed sentiment labels.

Useful additional attributes include:

```text
date/time
likes
retweets
language
topic
location
hashtag
source/platform
```

---

# Assignment Requirements

## 1. Use at Least 1,000 Tweets

Your dataset must contain at least 1,000 tweet records and a text/content field.

## 2. Keep Raw and Processed Data

Keep both the raw and cleaned datasets when redistribution is permitted.

If the dataset license does not permit redistribution, provide acquisition instructions instead.

## 3. Inspect Data Quality

Identify and address relevant problems such as:

```text
missing values
duplicates
incorrect types
inconsistent categories
malformed strings
invalid dates
invalid numeric values
```

Not every dataset will contain every problem.

## 4. Clean Structured Attributes

Use `pandas` to clean the problems that actually occur in your dataset.


## 5. Analyze Sentiment

Use the RoBERTa-based Transformer sentiment model demonstrated in the lab to estimate sentiment for every tweet.

Keep at least:

```text
sentiment
sentiment_score
```

You may also retain the negative, neutral, and positive class probabilities for visualization or analysis. Briefly document that these are model-generated sentiment estimates rather than ground-truth labels.

## 6. Create Tidy Visualization-Ready Data

Your final dataset should contain the variables needed for visualization.

For example:

```text
tweet_id
date
tweet_text
likes
retweets
sentiment_score
sentiment
another_attribute
```

## 7. Create a D3 Visualization

Create **one meaningful D3 visualization** that combines:

```text
Tweet sentiment
+
at least one other tweet attribute
```

Possible questions include:

```text
How does sentiment change over time?
Do highly retweeted tweets differ in sentiment?
How does sentiment differ across topics?
How does sentiment differ across hashtags or categories?
```

## 8. Add a Short Analysis

Under your visualization, write approximately **100–200 words** explaining:

1. what dataset you used;
2. the main cleaning decisions;
3. how sentiment was calculated;
4. what the visualization encodes;
5. one or two patterns you observe.

---

# What to Include on the Lab 4 Page

Your page should contain:

```text
Lab 4: Cleaning Web Data for Visualization

D3 visualization

Short analysis
```

You do not need to display all 1,000 tweets on the webpage.

---

## Optional Extension — Inspect Model Confidence

Explore where the RoBERTa model is confident or uncertain. For example, identify tweets where the highest sentiment probability is low or where two classes receive similar probabilities.

You may visualize uncertainty or manually inspect a small sample of difficult cases such as sarcasm, mixed sentiment, slang, or ambiguous language.

This extension encourages you to think critically about model-generated attributes before using them in a visualization.

---

# Suggested Repository Structure

```text
stats401-labs/
│
├── data/
│   ├── lab4_raw_tweets.csv
│   └── lab4_clean_tweets.csv
│
└── lab4/
    ├── index.html
    ├── lab4.js
    └── clean_tweets.py
```

Your Python cleaning script should make it possible to understand how the raw data was transformed into the processed data.

---

# What to Submit

Submit **one GitHub Pages link** that directly opens your Lab 4 assignment.

Example:

```text
https://yourusername.github.io/stats401-labs/lab4/
```

Your Python cleaning/analysis script should also be included in your GitHub repository.

---

# Submission Checklist

- [ ] My tweet dataset contains at least 1,000 records.
- [ ] I clean and process tweet dataset.
- [ ] I calculate sentiment for each tweet.
- [ ] My visualization shows sentiment and at least one other tweet attribute.
- [ ] I include a 100–200 word analysis below the visualization.
- [ ] My Python cleaning script is included in the repository.
- [ ] My page works correctly after deployment.
---
