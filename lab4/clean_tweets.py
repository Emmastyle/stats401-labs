"""Lab 4 cleaning and sentiment pipeline.

Practice file:   data/lab4_dirty_tweets.csv (50-row tutorial dataset)
Assignment file: data/lab4_raw_tweets.csv

The assignment tweets are a sample of the MIT-licensed Apple Vision Pro
dataset on Hugging Face:

    https://huggingface.co/datasets/divyasharma0795/AppleVisionPro_Tweets

The raw CSV keeps source columns (id, tweetText, handle, likeCount, ...)
and includes duplicate tweet IDs so the cleaning steps can be inspected.

Run:

    python lab4/clean_tweets.py
"""

from __future__ import annotations

import re
from pathlib import Path

import nltk
import pandas as pd
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from transformers import pipeline


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

PLATFORM_MAP = {
    "web": "Web",
    "mobile": "Mobile",
    "ios": "iOS",
    "android": "Android",
}

COUNTRY_MAP = {
    "US": "United States",
    "USA": "United States",
    "United States": "United States",
    "us": "United States",
    "U.S.": "United States",
    "UK": "United Kingdom",
    "uk": "United Kingdom",
    "United Kingdom": "United Kingdom",
    "Canada": "Canada",
    "CA": "Canada",
}

SENTIMENT_MAP = {
    "positive": "Positive",
    "pos": "Positive",
    "negative": "Negative",
    "neg": "Negative",
    "neutral": "Neutral",
}


def download_nltk_resources():
    """Download tokenizers, stop words, and WordNet once."""
    import ssl

    try:
        import certifi

        ssl._create_default_https_context = lambda: ssl.create_default_context(
            cafile=certifi.where()
        )
    except Exception:
        ssl._create_default_https_context = ssl._create_unverified_context

    for resource in ("punkt", "punkt_tab", "stopwords", "wordnet", "omw-1.4"):
        nltk.download(resource)


def normalize_tweet(text):
    text = text.lower()
    text = re.sub(r"https?://\S+|www\.\S+", " URL ", text)
    text = re.sub(r"@\w+", " USER ", text)
    text = re.sub(r"\b\d+(?:\.\d+)?\b", " NUMBER ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def remove_stopwords(tokens, stop_words):
    return [token for token in tokens if token not in stop_words]


def lemmatize_tokens(tokens, lemmatizer):
    return [
        lemmatizer.lemmatize(token)
        for token in tokens
        if token.isalpha()
    ]


def prepare_for_roberta(text):
    text = str(text)
    text = re.sub(r"@\w+", "@user", text)
    text = re.sub(r"https?://\S+|www\.\S+", "http", text)
    return text.strip()


def scores_to_dict(scores):
    return {item["label"].lower(): item["score"] for item in scores}


def predicted_label(scores):
    return max(scores, key=scores.get).capitalize()


def inspect_raw(df, label):
    print(f"\n=== Task 1 — Inspect ({label}) ===")
    print(df.head())
    print(df.shape)
    print(df.info())
    print(df.describe(include="all"))


def clean_structured_fields(df, has_categories=True):
    """Tasks 2–6: missing values, duplicates, types, dates, and categories."""
    print("\n=== Task 2 — Missing Values ===")
    print(df.isna().sum())
    print(df[df.isna().any(axis=1)])

    df = df.dropna(subset=["tweet_text"]).copy()
    if "retweets" in df.columns:
        df["retweets"] = df["retweets"].fillna(0)

    print("\n=== Task 3 — Duplicates ===")
    print(df.duplicated().sum())
    print(df[df.duplicated(keep=False)])
    df = df.drop_duplicates()

    print(
        df[df.duplicated(subset=["tweet_id"], keep=False)]
    )
    df = df.drop_duplicates(subset=["tweet_id"], keep="first")

    print("\n=== Task 4 — Incorrect Data Types ===")
    df["likes"] = (
        df["likes"].astype(str)
        .str.replace(",", "", regex=False)
    )
    df["likes"] = pd.to_numeric(df["likes"], errors="coerce")
    df["retweets"] = pd.to_numeric(df["retweets"], errors="coerce")
    df.loc[df["retweets"] < 0, "retweets"] = pd.NA

    # Likes: a missing or invalid count is unknown, so use the median.
    # Retweets: a missing or invalid count is treated as no retweets.
    df["likes"] = df["likes"].fillna(df["likes"].median())
    df["retweets"] = df["retweets"].fillna(0)

    if "views" in df.columns:
        df["views"] = pd.to_numeric(df["views"], errors="coerce").fillna(0)

    print("\n=== Task 5 — Parse Dates ===")
    df["created_at"] = pd.to_datetime(
        df["created_at"],
        errors="coerce",
        format="mixed",
        utc=True,
    )
    print(df[df["created_at"].isna()])
    df = df.dropna(subset=["created_at"])

    df["date"] = df["created_at"].dt.date
    df["hour"] = df["created_at"].dt.hour
    df["weekday"] = df["created_at"].dt.day_name()

    print("\n=== Task 6 — Standardize Categories and Strings ===")
    if has_categories and "platform" in df.columns:
        df["platform"] = (
            df["platform"].astype("string")
            .str.strip()
            .str.lower()
        )
        df["platform"] = df["platform"].map(PLATFORM_MAP)

    if has_categories and "country" in df.columns:
        df["country"] = df["country"].map(COUNTRY_MAP)

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

    if has_categories and "sentiment_raw" in df.columns:
        df["sentiment_raw"] = (
            df["sentiment_raw"].astype("string")
            .str.strip()
            .str.lower()
        )
        df["sentiment_clean"] = df["sentiment_raw"].map(SENTIMENT_MAP)

    return df.reset_index(drop=True)


def preprocess_for_tfidf(df):
    """Tasks 7–10: normalize, tokenize, prune vocabulary, DTM, TF-IDF."""
    print("\n=== Task 7 — Tweet Preprocessing ===")
    df["text_normalized"] = df["tweet_text"].apply(normalize_tweet)
    df["tokens"] = df["text_normalized"].apply(word_tokenize)

    stop_words = set(stopwords.words("english"))
    df["tokens_no_stop"] = df["tokens"].apply(
        lambda tokens: remove_stopwords(tokens, stop_words)
    )

    lemmatizer = WordNetLemmatizer()
    df["tokens_clean"] = df["tokens_no_stop"].apply(
        lambda tokens: lemmatize_tokens(tokens, lemmatizer)
    )
    df["text_clean"] = df["tokens_clean"].apply(" ".join)
    print(df[["tweet_text_raw", "text_clean"]].head())

    print("\n=== Task 8 — Prune the Vocabulary ===")
    vectorizer = CountVectorizer(min_df=2, max_df=0.90, lowercase=True)
    dtm = vectorizer.fit_transform(df["text_clean"])
    terms = vectorizer.get_feature_names_out()
    print(terms)
    print("Vocabulary size:", len(terms))

    print("\n=== Task 9 — Create a Document-Term Matrix (DTM) ===")
    print(dtm.shape)
    dtm_df = pd.DataFrame(dtm.toarray(), columns=vectorizer.get_feature_names_out())
    print(dtm_df.head())

    print("\n=== Task 10 — TF-IDF ===")
    tfidf_vectorizer = TfidfVectorizer(min_df=2, max_df=0.90)
    tfidf = tfidf_vectorizer.fit_transform(df["text_clean"])
    print(tfidf.shape)
    print(tfidf_vectorizer.get_feature_names_out())
    tfidf_df = pd.DataFrame(
        tfidf.toarray(),
        columns=tfidf_vectorizer.get_feature_names_out(),
    )
    print(tfidf_df.head())
    return df


def apply_roberta_sentiment(df, sentiment_model):
    """Tasks 11–12: light normalization and RoBERTa class scores."""
    print("\n=== Task 12 — Apply RoBERTa Sentiment Analysis ===")
    df["sentiment_text"] = (
        df["tweet_text_raw"].fillna("").apply(prepare_for_roberta)
    )

    results = sentiment_model(
        df["sentiment_text"].tolist(),
        truncation=True,
        batch_size=16,
    )

    score_dicts = [scores_to_dict(scores) for scores in results]
    df["sentiment_negative"] = [
        scores.get("negative", 0) for scores in score_dicts
    ]
    df["sentiment_neutral"] = [
        scores.get("neutral", 0) for scores in score_dicts
    ]
    df["sentiment_positive"] = [
        scores.get("positive", 0) for scores in score_dicts
    ]
    df["sentiment"] = [predicted_label(scores) for scores in score_dicts]
    df["sentiment_score"] = df["sentiment_positive"] - df["sentiment_negative"]
    df["sentiment_confidence"] = df[
        ["sentiment_negative", "sentiment_neutral", "sentiment_positive"]
    ].max(axis=1)

    print(
        df[[
            "tweet_text_raw",
            "sentiment_negative",
            "sentiment_neutral",
            "sentiment_positive",
            "sentiment",
        ]].head()
    )
    print(df[["tweet_text_raw", "sentiment", "sentiment_score"]].head())
    return df


def format_vis_frame(vis_df):
    """Write timestamps in UTC ISO form so D3 can parse them reliably."""
    vis_df["created_at"] = pd.to_datetime(vis_df["created_at"], utc=True)
    vis_df["date"] = vis_df["created_at"].dt.strftime("%Y-%m-%d")
    vis_df["created_at"] = vis_df["created_at"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    vis_df["likes"] = vis_df["likes"].astype(int)
    vis_df["retweets"] = vis_df["retweets"].astype(int)
    if "views" in vis_df.columns:
        vis_df["views"] = vis_df["views"].astype(int)
    return vis_df


def export_practice(df):
    vis_columns = [
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
        "sentiment",
    ]
    vis_df = format_vis_frame(df[vis_columns].copy())
    print("\n=== Task 13 — Practice tidy data ===")
    print(vis_df.head())
    print(vis_df.info())
    print(vis_df.isna().sum())
    print(vis_df["sentiment"].value_counts())
    vis_df.to_csv(DATA_DIR / "lab4_practice_clean.csv", index=False)

    sentiment_counts = (
        vis_df["sentiment"]
        .value_counts()
        .rename_axis("sentiment")
        .reset_index(name="count")
    )
    sentiment_counts.to_csv(DATA_DIR / "lab4_practice_sentiment_counts.csv", index=False)

    sentiment_platform = (
        vis_df.groupby(["platform", "sentiment"])
        .size()
        .reset_index(name="count")
    )
    sentiment_platform.to_csv(DATA_DIR / "sentiment_by_platform.csv", index=False)

    sentiment_time = (
        vis_df.groupby("weekday")["sentiment_score"]
        .mean()
        .reset_index()
    )
    sentiment_time.to_csv(
        DATA_DIR / "lab4_practice_sentiment_by_weekday.csv",
        index=False,
    )
    print("Saved practice outputs.")
    return vis_df


def export_assignment(df):
    vis_columns = [
        "tweet_id",
        "created_at",
        "date",
        "hour",
        "weekday",
        "username",
        "tweet_text_raw",
        "text_clean",
        "likes",
        "retweets",
        "views",
        "sentiment_negative",
        "sentiment_neutral",
        "sentiment_positive",
        "sentiment_confidence",
        "sentiment_score",
        "sentiment",
    ]
    vis_df = format_vis_frame(df[vis_columns].copy())
    print("\n=== Task 13 — Assignment tidy data ===")
    print(vis_df.head())
    print(vis_df.info())
    print(vis_df.isna().sum())
    print(vis_df["sentiment"].value_counts())
    vis_df.to_csv(DATA_DIR / "lab4_clean_tweets.csv", index=False)

    print("\n=== Task 14 — Aggregate Data for Visualization ===")
    sentiment_counts = (
        vis_df["sentiment"]
        .value_counts()
        .rename_axis("sentiment")
        .reset_index(name="count")
    )
    sentiment_counts.to_csv(DATA_DIR / "sentiment_counts.csv", index=False)

    sentiment_time = (
        vis_df.groupby("weekday")["sentiment_score"]
        .mean()
        .reset_index()
    )
    weekday_order = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ]
    sentiment_time["weekday"] = pd.Categorical(
        sentiment_time["weekday"],
        categories=weekday_order,
        ordered=True,
    )
    sentiment_time = sentiment_time.sort_values("weekday")
    sentiment_time.to_csv(DATA_DIR / "sentiment_by_weekday.csv", index=False)
    print("Saved assignment visualization files.")
    print("Final assignment rows:", len(vis_df))
    return vis_df


def load_assignment_raw():
    raw = pd.read_csv(DATA_DIR / "lab4_raw_tweets.csv")
    return raw.rename(
        columns={
            "id": "tweet_id",
            "createdAt": "created_at",
            "handle": "username",
            "tweetText": "tweet_text",
            "likeCount": "likes",
            "retweetCount": "retweets",
        }
    )


def main():
    download_nltk_resources()

    print("Loading RoBERTa sentiment model...")
    sentiment_model = pipeline(
        "sentiment-analysis",
        model="cardiffnlp/twitter-roberta-base-sentiment-latest",
        top_k=None,
    )
    test_tweet = "I absolutely love this new update!"
    print(sentiment_model(test_tweet))

    practice = pd.read_csv(DATA_DIR / "lab4_dirty_tweets.csv")
    inspect_raw(practice, "practice")
    practice = clean_structured_fields(practice, has_categories=True)
    practice = preprocess_for_tfidf(practice)
    practice = apply_roberta_sentiment(practice, sentiment_model)
    export_practice(practice)

    assignment = load_assignment_raw()
    inspect_raw(assignment, "assignment")
    assignment = clean_structured_fields(assignment, has_categories=False)
    assignment = preprocess_for_tfidf(assignment)
    assignment = apply_roberta_sentiment(assignment, sentiment_model)
    vis_df = export_assignment(assignment)

    if len(vis_df) < 1000:
        raise SystemExit(
            f"Assignment dataset has {len(vis_df)} tweets after cleaning; "
            "need at least 1,000."
        )


if __name__ == "__main__":
    main()
