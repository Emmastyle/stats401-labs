"""Build the Lab 8 bulletin corpus, embeddings, and visualization tables.

Assignment source:
Bulletin of Duke Kunshan University Undergraduate Instruction, 2021-2022.
https://dku-web-admissions.s3.cn-north-1.amazonaws.com.cn/dkumain/files/V2021-22_DKU_UG_Bulletin.pdf
"""

import re
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
import pymupdf
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "data" / "V2021-22_DKU_UG_Bulletin.pdf"
CACHE_PATH = ROOT / "data" / "lab8_embeddings.npy"
PASSAGE_CACHE = ROOT / "data" / "lab8_passages_clean.csv"
MAP_PATH = ROOT / "data" / "lab8_embedding_map.csv"
MATRIX_PATH = ROOT / "data" / "lab8_topic_section_matrix.csv"
TFIDF_PATH = ROOT / "data" / "lab8_top_tfidf.csv"
TERMS_PATH = ROOT / "data" / "lab8_top_terms.csv"
REPORT_PATH = ROOT / "data" / "lab8_cluster_report.txt"

# Labels are assigned after inspecting representative passages and TF-IDF terms.
# Filled in after the first clustering run; keys are KMeans cluster ids.
CLUSTER_NAMES = {
    0: "Quantitative and Physical Sciences",
    1: "Policy, Health, and Society",
    2: "Credit and Degree Requirements",
    3: "Academic Calendar and Deadlines",
    4: "Global History, Culture, and Politics",
    5: "Academic Standing and Withdrawal",
    6: "Language, Media, and Skills",
    7: "University Identity and Study Away",
}

LIGATURES = {
    "\ufb01": "fi",
    "\ufb02": "fl",
    "\u2013": "-",
    "\u2014": "-",
    "\u2010": "-",
    "\u2011": "-",
    "\u2019": "'",
    "\u2018": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u00a0": " ",
    "\u00ad": "",
    "\u2022": " ",
}


def normalize_heading(text):
    for src, dst in LIGATURES.items():
        text = text.replace(src, dst)
    text = text.replace("–", "-").replace("—", "-")
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text.rstrip(" .:")


def clean_passage(text):
    for src, dst in LIGATURES.items():
        text = text.replace(src, dst)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def same_heading(block_text, title):
    left = normalize_heading(block_text)
    right = normalize_heading(title)
    if not left or not right:
        return False
    if left == right:
        return True
    shorter, longer = (left, right) if len(left) <= len(right) else (right, left)
    if len(shorter) >= 28 and longer.startswith(shorter):
        return True
    return False


def block_text(block):
    lines = []
    size = None
    font = ""
    for line in block["lines"]:
        pieces = []
        for span in line["spans"]:
            if size is None:
                size = span["size"]
                font = span["font"]
            pieces.append(span["text"])
        line_text = "".join(pieces).strip()
        if line_text:
            lines.append(line_text)
    if not lines:
        return "", 0, ""
    merged = ""
    for line in lines:
        if merged.endswith("-") and line and line[0].islower():
            merged = merged[:-1] + line
        elif merged:
            merged += " " + line
        else:
            merged = line
    return re.sub(r"\s+", " ", merged).strip(), size or 0, font


def extract_raw_passages(doc):
    toc = doc.get_toc()
    headings_by_page = defaultdict(list)
    for level, title, page in toc:
        if page >= 10:
            headings_by_page[page].append((level, title))

    chapter = ""
    section = ""
    levels = {3: "", 4: "", 5: ""}
    passages = []
    unmatched = []
    matched = 0
    raw_blocks = 0

    def subsection():
        parts = [levels[3], levels[4], levels[5]]
        return " / ".join(part for part in parts if part)

    def apply_heading(level, title):
        nonlocal chapter, section
        if level <= 1:
            chapter = title
            section = ""
            levels[3] = levels[4] = levels[5] = ""
        elif level == 2:
            section = title
            levels[3] = levels[4] = levels[5] = ""
        elif level == 3:
            levels[3] = title
            levels[4] = levels[5] = ""
        elif level == 4:
            levels[4] = title
            levels[5] = ""
        else:
            levels[5] = title

    for page_index in range(9, doc.page_count):
        page_no = page_index + 1
        pending = list(headings_by_page.get(page_no, []))
        cursor = 0
        page = doc[page_index]
        blocks = []
        for block in page.get_text("dict")["blocks"]:
            if block.get("type") != 0:
                continue
            text, size, font = block_text(block)
            if not text or re.fullmatch(r"\d{1,3}", text):
                continue
            if size < 9.5:
                continue
            blocks.append((block["bbox"][1], block["bbox"][0], text, size, font))
        blocks.sort()

        for _, _, text, size, font in blocks:
            raw_blocks += 1
            heading = None
            for offset in range(4):
                index = cursor + offset
                if index >= len(pending):
                    break
                level, title = pending[index]
                if same_heading(text, title) and len(text.split()) <= 45:
                    heading = (index, level, title)
                    break
            if heading is not None:
                index, level, title = heading
                if index > cursor:
                    unmatched.extend(pending[cursor:index])
                apply_heading(level, title)
                cursor = index + 1
                matched += 1
                continue

            if text.lower().startswith("prerequisite"):
                if passages and passages[-1]["page"] >= page_no - 1:
                    passages[-1]["text"] = clean_passage(
                        passages[-1]["text"] + " " + text
                    )
                continue

            formal_section = section or chapter or "Front matter"
            if (
                passages
                and text[:1].islower()
                and passages[-1]["section"] == formal_section
                and page_no - passages[-1]["page"] <= 1
            ):
                passages[-1]["text"] = clean_passage(passages[-1]["text"] + " " + text)
                continue

            passages.append(
                {
                    "chapter": chapter or "Front matter",
                    "section": formal_section,
                    "subsection": subsection(),
                    "page": page_no,
                    "text": clean_passage(text),
                }
            )
        if cursor < len(pending):
            unmatched.extend(pending[cursor:])

    return passages, raw_blocks, matched, unmatched


def is_table_fragment(text):
    if re.fullmatch(r"[A-Z]{2,12}\s*\d{2,3}[A-Z]?(?:\s*/\s*[A-Z]{2,12}\s*\d{2,3}[A-Z]?)?", text):
        return True
    if re.fullmatch(r"[\d.]+", text):
        return True
    # Major-requirement tables list a course code, a title, and sometimes a credit.
    # Those rows are not passages that can be read on their own.
    if (
        re.match(r"^[A-Z]{2,12}\s+\d{2,3}\b", text)
        and len(text.split()) < 28
        and "." not in text
    ):
        return True
    lowered = text.lower().strip(" .")
    boilerplate = {
        "course code",
        "course name",
        "course credit",
        "credit",
        "requirements",
        "course",
        "none",
        "or",
        "and",
    }
    return lowered in boilerplate


def clean_corpus(passages):
    df = pd.DataFrame(passages)
    raw_count = len(df)
    df = df.dropna(subset=["text"])
    df["text"] = df["text"].map(clean_passage)
    df = df[df["text"].str.len() > 0]
    df = df[~df["text"].map(is_table_fragment)]
    df["word_count"] = df["text"].str.split().str.len()
    df = df[df["word_count"] >= 12]
    before_dupes = len(df)
    df = df.drop_duplicates(subset=["text"])
    df = df.reset_index(drop=True)
    df.insert(0, "passage_id", [f"p{i+1:04d}" for i in range(len(df))])
    df["text_clean"] = df["text"]
    stats = {
        "raw_blocks_kept": raw_count,
        "after_length_filter": before_dupes,
        "after_cleaning": len(df),
    }
    return df, stats


def top_meaningful_terms(texts, n_terms=15):
    from sklearn.feature_extraction.text import CountVectorizer

    vectorizer = CountVectorizer(
        stop_words="english",
        ngram_range=(1, 1),
        min_df=5,
        token_pattern=r"[a-zA-Z][a-zA-Z-]{2,}",
    )
    matrix = vectorizer.fit_transform(texts)
    counts = np.asarray(matrix.sum(axis=0)).ravel()
    terms = np.array(vectorizer.get_feature_names_out())
    order = counts.argsort()[::-1][:n_terms]
    return pd.DataFrame({"term": terms[order], "count": counts[order].astype(int)})


def top_tfidf_terms(texts, n_terms=15):
    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        min_df=5,
        max_df=0.4,
        token_pattern=r"[a-zA-Z][a-zA-Z-]{2,}",
    )
    matrix = vectorizer.fit_transform(texts)
    scores = np.asarray(matrix.mean(axis=0)).ravel()
    terms = np.array(vectorizer.get_feature_names_out())
    order = scores.argsort()[::-1][:n_terms]
    return pd.DataFrame({"term": terms[order], "mean_tfidf": scores[order]}), vectorizer, matrix


def cluster_terms(df, vectorizer, matrix, cluster_id, n_terms=8):
    mask = (df["cluster"] == cluster_id).to_numpy()
    if mask.sum() == 0:
        return []
    scores = np.asarray(matrix[mask].mean(axis=0)).ravel()
    terms = np.array(vectorizer.get_feature_names_out())
    order = scores.argsort()[::-1][:n_terms]
    return list(terms[order])


def main():
    doc = pymupdf.open(PDF_PATH)
    passages, raw_blocks, matched, unmatched = extract_raw_passages(doc)
    df, stats = clean_corpus(passages)
    print("PDF pages", doc.page_count)
    print("raw text blocks", raw_blocks)
    print("headings matched", matched)
    print("headings unmatched", len(unmatched))
    if unmatched[:12]:
        print("unmatched sample:")
        for item in unmatched[:12]:
            print(" ", item)
    print("passages before length/table filter", stats["raw_blocks_kept"])
    print("after length filter", stats["after_length_filter"])
    print("after duplicate removal", stats["after_cleaning"])
    print(df["word_count"].describe())
    print("chapters", df["chapter"].nunique(), "sections", df["section"].nunique())
    print(df["chapter"].value_counts())

    if CACHE_PATH.exists() and PASSAGE_CACHE.exists():
        cached = pd.read_csv(PASSAGE_CACHE)
        if len(cached) == len(df) and cached["text"].tolist() == df["text"].tolist():
            embeddings = np.load(CACHE_PATH)
            print("loaded cached embeddings", embeddings.shape)
        else:
            embeddings = None
    else:
        embeddings = None

    if embeddings is None:
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer("all-MiniLM-L6-v2")
        embeddings = model.encode(
            df["text_clean"].tolist(),
            normalize_embeddings=True,
            batch_size=64,
            show_progress_bar=True,
        )
        np.save(CACHE_PATH, embeddings)
        df.to_csv(PASSAGE_CACHE, index=False)
        print("embeddings", embeddings.shape)

    import umap

    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=15,
        min_dist=0.15,
        metric="cosine",
        random_state=401,
    )
    coords = reducer.fit_transform(embeddings)
    df["x"] = coords[:, 0]
    df["y"] = coords[:, 1]

    kmeans = KMeans(n_clusters=8, random_state=401, n_init="auto")
    df["cluster"] = kmeans.fit_predict(embeddings)

    tfidf_table, vectorizer, matrix = top_tfidf_terms(df["text_clean"])
    tfidf_table.to_csv(TFIDF_PATH, index=False)
    top_meaningful_terms(df["text_clean"]).to_csv(TERMS_PATH, index=False)

    similarity = cosine_similarity(embeddings)
    neighbor_ids = []
    neighbor_scores = []
    for row_index, row in enumerate(similarity):
        order = np.argsort(row)[::-1]
        picked = [index for index in order if index != row_index][:5]
        neighbor_ids.append("|".join(df.iloc[index]["passage_id"] for index in picked))
        neighbor_scores.append("|".join(f"{row[index]:.4f}" for index in picked))
    df["neighbor_ids"] = neighbor_ids
    df["neighbor_scores"] = neighbor_scores

    if CLUSTER_NAMES:
        df["cluster_name"] = df["cluster"].map(CLUSTER_NAMES)
    else:
        df["cluster_name"] = df["cluster"].map(lambda c: f"Cluster {c}")

    lines = []
    for cluster_id in sorted(df["cluster"].unique()):
        subset = df[df["cluster"] == cluster_id]
        lines.append(f"\nCLUSTER {cluster_id} n={len(subset)}")
        lines.append("terms: " + ", ".join(cluster_terms(df, vectorizer, matrix, cluster_id)))
        lines.append("sections: " + ", ".join(
            f"{name} ({count})" for name, count in subset["section"].value_counts().head(6).items()
        ))
        for text in subset["text_clean"].head(8):
            lines.append("- " + text[:280])
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines[:80]))
    print("report", REPORT_PATH)

    export_cols = [
        "passage_id",
        "chapter",
        "section",
        "subsection",
        "page",
        "text",
        "word_count",
        "cluster",
        "cluster_name",
        "x",
        "y",
        "neighbor_ids",
        "neighbor_scores",
    ]
    df[export_cols].to_csv(MAP_PATH, index=False)

    matrix_df = (
        df.groupby(["section", "cluster_name"], as_index=False)
        .size()
        .rename(columns={"size": "count"})
    )
    section_totals = matrix_df.groupby("section")["count"].transform("sum")
    matrix_df["proportion"] = matrix_df["count"] / section_totals
    chapter_lookup = df.groupby("section")["chapter"].agg(lambda s: s.mode().iloc[0])
    matrix_df["chapter"] = matrix_df["section"].map(chapter_lookup)
    matrix_df.to_csv(MATRIX_PATH, index=False)
    print("wrote", MAP_PATH, MATRIX_PATH)


if __name__ == "__main__":
    main()
