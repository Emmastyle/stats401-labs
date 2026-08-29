# Lab 1 — Getting Started with D3.js

**STATS 401: Data Acquisition and Visualization**

## Learning Objectives

By the end of this lab, you should be able to:

1. Explain the roles of HTML, CSS, and JavaScript in a web visualization.
2. Add the D3.js library to a webpage.
3. Use JavaScript and D3 to manipulate the Document Object Model (DOM).
4. Create basic graphical elements using SVG.
5. Load CSV and JSON data using D3.
6. Build a course webpage containing navigation tabs for all 10 labs.
7. Run a D3 website locally.
8. Publish a D3 website using GitHub Pages.
9. Create and deploy your first D3 visualization.

---

## 0. Preparation

For this course, each student will maintain one website containing all 10 labs.

A recommended project structure is:

```text
stats401-labs/
│
├── index.html
├── css/
│   └── style.css
├── js/
│   └── main.js
│
├── data/
│   ├── students.csv
│   └── students.json
│
├── lab1/
│   └── index.html
├── lab2/
│   └── index.html
├── lab3/
│   └── index.html
├── lab4/
│   └── index.html
├── lab5/
│   └── index.html
├── lab6/
│   └── index.html
├── lab7/
│   └── index.html
├── lab8/
│   └── index.html
├── lab9/
│   └── index.html
└── lab10/
    └── index.html
```

This website will grow throughout the semester.

Your final URL may look similar to:

```text
https://yourusername.github.io/stats401-labs/
```

---

# Task 1 — HTML, CSS, and JavaScript

Before learning D3, we need to understand the three fundamental technologies used by webpages.

<mark>For more detailed information about HTML, CSS, and JS, please refer to https://www.w3schools.com/html/default.asp</mark>

## 1.1 HTML

HTML defines the **structure and content** of a webpage.

Create a file named:

```text
index.html
```

Add the following code:

```html
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport"
          content="width=device-width, initial-scale=1.0">

    <title>STATS 401 Labs</title>
</head>

<body>

    <h1>STATS 401: Data Acquisition and Visualization</h1>

    <h2>Lab 1: Getting Started with D3.js</h2>

    <p>
        This is my first webpage for STATS 401.
    </p>

</body>

</html>
```

Open `index.html` in your browser.

You should see a simple webpage containing a heading and paragraph.

---

## 1.2 Common HTML Elements

Some HTML elements you will frequently use include:

```html
<h1>Main heading</h1>

<h2>Section heading</h2>

<p>This is a paragraph.</p>

<a href="https://d3js.org/">Visit D3</a>

<button>Click Me</button>

<div>
    A general container
</div>
```

The `<div>` element is especially important because we frequently use it as a container for visualizations.

For example:

```html
<div id="chart"></div>
```

Later, D3 can locate this element and insert a visualization inside it.

---

## 1.3 CSS

CSS controls the **appearance** of a webpage.

<mark>For more detailed information, please refer to https://www.w3schools.com/css/css_syntax.asp</mark>

Create:

```text
css/style.css
```

Add:

```css
body {
    font-family: Arial, sans-serif;
    max-width: 1000px;
    margin: 40px auto;
    padding: 0 20px;
}

h1 {
    font-size: 32px;
}

h2 {
    margin-top: 30px;
}

p {
    line-height: 1.6;
}

#chart {
    margin-top: 30px;
}
```

Now connect the CSS file to your HTML.

Inside `<head>`, add:

```html
<link rel="stylesheet" href="css/style.css">
```

Your `<head>` should now look like:

```html
<head>

    <meta charset="UTF-8">

    <meta name="viewport"
          content="width=device-width, initial-scale=1.0">

    <title>STATS 401 Labs</title>

    <link rel="stylesheet" href="css/style.css">

</head>
```

Refresh the browser.

The webpage should now have improved spacing and typography.

---

## 1.4 JavaScript

JavaScript provides **behavior and interaction**.

Create:

```text
js/main.js
```

Add:

```javascript
console.log("Hello STATS 401!");
```

Connect it to the webpage immediately before `</body>`:

```html
<script src="js/main.js"></script>
```

Your page should end with:

```html
<script src="js/main.js"></script>

</body>
</html>
```

Open the browser's Developer Tools.

Usually:

```text
Right Click → Inspect → Console
```

You should see:

```text
Hello STATS 401!
```

---

## 1.5 JavaScript Variables

<mark>For more detailed information, please refer to https://www.w3schools.com/js/js_syntax.asp</mark>

Try adding:

```javascript
let course = "STATS 401";
let students = 40;

console.log(course);
console.log(students);
```

JavaScript arrays will be particularly important in D3:

```javascript
let data = [10, 20, 30, 40, 50];

console.log(data);
```

Objects are also frequently used:

```javascript
let student = {
    name: "Alice",
    score: 85
};

console.log(student.name);
console.log(student.score);
```

A D3 dataset is often an **array of objects**:

```javascript
let students = [
    {name: "Alice", score: 85},
    {name: "Bob", score: 72},
    {name: "Carol", score: 91}
];

console.log(students);
```

---

# Task 2 — Set Up D3.js

D3 stands for **Data-Driven Documents**.

D3 is a JavaScript library designed for creating data-driven web visualizations.

<mark>For more detailed information about D3, please refer to https://d3js.org/what-is-d3</mark>

It provides tools for:

- selecting webpage elements;
- binding data to elements;
- creating scales;
- creating axes;
- manipulating SVG;
- loading external datasets;
- animation;
- interaction;
- geographic visualization;
- network visualization.

---

## 2.1 Add D3 to the Webpage

For this course, we will initially use D3 through a CDN.

Add the following before your own JavaScript:

```html
<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>

<script src="js/main.js"></script>
```

The order matters.

D3 must be loaded **before** `main.js`.

---

## 2.2 Verify D3

Add this to `main.js`:

```javascript
console.log(d3);
```

Or:

```javascript
console.log("D3 version:", d3.version);
```

Open the browser console.

If D3 was successfully loaded, you should see its version number.

---

## 2.3 Your First D3 Command

Add a paragraph:

```html
<p id="message">Original message</p>
```

Then use D3:

```javascript
d3.select("#message")
    .text("This text was changed using D3!");
```

Refresh the webpage.

The text should change.

This demonstrates one of D3's central ideas:

```text
Find an element
      ↓
Select it
      ↓
Modify it
```

---

# Task 3 — Understanding the DOM

## 3.1 What Is the DOM?

When a browser reads HTML, it converts it into a tree-like structure called the:

**Document Object Model (DOM)**

For example:

```html
<body>

    <h1>STATS 401</h1>

    <div id="chart">

        <p>Hello</p>

    </div>

</body>
```

Conceptually becomes:

```text
document
   │
   └── body
       │
       ├── h1
       │
       └── div #chart
              │
              └── p
```

JavaScript and D3 manipulate this structure.

---

## 3.2 Selecting Elements

Suppose the webpage contains:

```html
<h2 id="title">My Visualization</h2>

<p class="description">
    Visualization description
</p>
```

D3 can select by tag:

```javascript
d3.select("h2");
```

Select by ID:

```javascript
d3.select("#title");
```

Select by class:

```javascript
d3.select(".description");
```

---

## 3.3 Changing Text

```javascript
d3.select("#title")
    .text("Student Score Visualization");
```

---

## 3.4 Changing Styles

```javascript
d3.select("#title")
    .style("color", "steelblue")
    .style("font-size", "28px");
```

Notice that D3 frequently uses **method chaining**:

```javascript
d3.select("#title")
    .style("color", "steelblue")
    .style("font-size", "28px")
    .style("font-weight", "bold");
```

---

## 3.5 Adding Elements

Start with:

```html
<div id="content"></div>
```

Then:

```javascript
d3.select("#content")
    .append("p")
    .text("This paragraph was created using D3.");
```

You can create multiple elements:

```javascript
const content = d3.select("#content");

content.append("h3")
    .text("My Dataset");

content.append("p")
    .text("The dataset contains student scores.");
```

---

## 3.6 Data Binding

The defining feature of D3 is binding data to DOM elements.

Consider:

```javascript
const data = [10, 20, 30, 40, 50];
```

Add:

```html
<div id="numbers"></div>
```

Then:

```javascript
d3.select("#numbers")
    .selectAll("p")
    .data(data)
    .join("p")
    .text(d => `Value: ${d}`);
```

The result is conceptually:

```text
Value: 10
Value: 20
Value: 30
Value: 40
Value: 50
```

The critical pattern is:

```javascript
selection
    .selectAll(...)
    .data(data)
    .join(...)
```

We will use this pattern repeatedly throughout the semester.

---

# Task 4 — SVG

D3 often uses **SVG** to draw visualizations.

SVG stands for:

**Scalable Vector Graphics**

Unlike a normal image, SVG consists of graphical elements represented directly in the DOM.

---

## 4.1 Create an SVG

Add:

```html
<svg width="600" height="300"></svg>
```

You will initially see nothing because the SVG is an empty drawing area.

Think of it as a coordinate system:

```text
(0,0) --------------------→ x
 |
 |
 |
 |
 ↓
 y
```

One important difference from a mathematical coordinate system is that the y-axis increases **downward**.

---

## 4.2 Draw a Circle

```html
<svg width="600" height="300">

    <circle
        cx="100"
        cy="100"
        r="40"
        fill="steelblue">
    </circle>

</svg>
```

Where:

```text
cx = horizontal position
cy = vertical position
r  = radius
```

---

## 4.3 Draw a Rectangle

```html
<svg width="600" height="300">

    <rect
        x="50"
        y="50"
        width="120"
        height="80"
        fill="orange">
    </rect>

</svg>
```

---

## 4.4 Draw SVG with D3

Instead of manually writing SVG, D3 can create it.

First add:

```html
<div id="svg-demo"></div>
```

Then:

```javascript
const svg = d3.select("#svg-demo")
    .append("svg")
    .attr("width", 600)
    .attr("height", 300);
```

Now add a circle:

```javascript
svg.append("circle")
    .attr("cx", 100)
    .attr("cy", 100)
    .attr("r", 40)
    .attr("fill", "steelblue");
```

Add a rectangle:

```javascript
svg.append("rect")
    .attr("x", 200)
    .attr("y", 60)
    .attr("width", 120)
    .attr("height", 80)
    .attr("fill", "orange");
```

---

## 4.5 Create Several Circles from Data

Suppose:

```javascript
const values = [10, 20, 30, 40, 50];
```

Create:

```javascript
const svg = d3.select("#svg-demo")
    .append("svg")
    .attr("width", 600)
    .attr("height", 200);
```

Bind the data:

```javascript
svg.selectAll("circle")
    .data(values)
    .join("circle")
    .attr("cx", (d, i) => 60 + i * 100)
    .attr("cy", 100)
    .attr("r", d => d / 2)
    .attr("fill", "steelblue");
```

Here:

```javascript
d
```

represents the current data value.

And:

```javascript
i
```

represents its index.

For example:

```text
d = 10, i = 0
d = 20, i = 1
d = 30, i = 2
...
```

This is your first example of **data-driven graphics**.

<img width="1086" height="386" alt="image" src="https://github.com/user-attachments/assets/69a8ef1e-610c-45ea-8a1c-2498980f0c03" />

---

# Task 5 — Loading CSV and JSON Data

Most real visualizations do not contain the dataset directly inside JavaScript.

Instead, data comes from external files.

D3 can load formats including:

```text
CSV
JSON
TSV
GeoJSON
```

In this lab, we will use CSV and JSON.

---

## 5.1 Create a CSV Dataset

Create:

```text
data/students.csv
```

Add:

```csv
name,score
Alice,85
Bob,72
Carol,91
David,66
Emma,88
Frank,74
Grace,95
```

---

## 5.2 Load CSV Using D3

Use:

```javascript
d3.csv("data/students.csv")
    .then(data => {

        console.log(data);

    });
```

Open Developer Tools.

You should see an array containing student objects.

---

## 5.3 Important: CSV Values Are Initially Strings

Try:

```javascript
d3.csv("data/students.csv")
    .then(data => {

        console.log(data[0]);
        console.log(typeof data[0].score);

    });
```

You may see:

```text
"85"
```

rather than:

```text
85
```

CSV values are normally loaded as strings.

Convert them:

```javascript
d3.csv("data/students.csv")
    .then(data => {

        data.forEach(d => {
            d.score = +d.score;
        });

        console.log(data);

    });
```

The unary `+` converts the string to a number.

Another approach is:

```javascript
d.score = Number(d.score);
```

---

## 5.4 Row Conversion

A cleaner version is:

```javascript
d3.csv("data/students.csv", d => {

    return {
        name: d.name,
        score: +d.score
    };

}).then(data => {

    console.log(data);

});
```

This converts each row while loading it.

---

## 5.5 JSON Data

Create:

```text
data/students.json
```

Add:

```json
[
    {
        "name": "Alice",
        "score": 85
    },
    {
        "name": "Bob",
        "score": 72
    },
    {
        "name": "Carol",
        "score": 91
    }
]
```

Load it using:

```javascript
d3.json("data/students.json")
    .then(data => {

        console.log(data);

    });
```

Unlike CSV, JSON can preserve numeric data types.

---

## 5.6 Using async/await

We will frequently use `async/await` during this course because it makes data-loading code easier to read.

Example:

```javascript
async function loadData() {

    const data = await d3.csv(
        "data/students.csv",
        d => ({
            name: d.name,
            score: +d.score
        })
    );

    console.log(data);

}

loadData();
```

Conceptually:

```text
Request data
     ↓
Wait until data arrives
     ↓
Convert data
     ↓
Use data
```

---

## 5.7 Run a Local Web Server

Loading local files such as CSV or JSON may not work reliably by double-clicking `index.html` because browsers restrict some requests made from `file://` pages.

Instead, run a local web server.

Because Python will be used elsewhere in this course, we can use Python's built-in HTTP server.

Open a terminal inside your project folder:

```bash
cd stats401-labs
```

Run:

```bash
python -m http.server 8000
```

If your system uses `python3`:

```bash
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

Stop the server with:

```text
Ctrl + C
```

You should use a local server for all future D3 labs.

---

# Task 6 — Create Navigation for All 10 Labs

Your website will eventually contain all labs from the course.

We will create the navigation structure now so you can extend the same website throughout the semester.

## 6.1 Create the Navigation Bar

Add this near the top of `index.html`:

```html
<nav class="lab-nav">

    <a href="lab1/index.html">Lab 1</a>
    <a href="lab2/index.html">Lab 2</a>
    <a href="lab3/index.html">Lab 3</a>
    <a href="lab4/index.html">Lab 4</a>
    <a href="lab5/index.html">Lab 5</a>
    <a href="lab6/index.html">Lab 6</a>
    <a href="lab7/index.html">Lab 7</a>
    <a href="lab8/index.html">Lab 8</a>
    <a href="lab9/index.html">Lab 9</a>
    <a href="lab10/index.html">Lab 10</a>

</nav>
```

## 6.2 Style the Navigation

Add to `style.css`:

```css
.lab-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 30px 0;
    padding-bottom: 15px;
    border-bottom: 1px solid #ddd;
}

.lab-nav a {
    padding: 8px 14px;
    text-decoration: none;
    background: #f1f1f1;
    color: #333;
    border-radius: 5px;
}

.lab-nav a:hover {
    background: #333;
    color: white;
}
```

Your webpage will now contain navigation resembling:

```text
Lab 1 | Lab 2 | Lab 3 | Lab 4 | Lab 5
Lab 6 | Lab 7 | Lab 8 | Lab 9 | Lab 10
```

## 6.3 Create Placeholder Lab Pages

Create:

```text
lab1/index.html
lab2/index.html
...
lab10/index.html
```

For now, a placeholder page can contain:

```html
<!DOCTYPE html>

<html lang="en">

<head>

    <meta charset="UTF-8">

    <title>Lab 2</title>

</head>

<body>

    <h1>Lab 2</h1>

    <p>
        Lab 2 will be added here.
    </p>

    <a href="../index.html">
        Back to home
    </a>

</body>

</html>
```

Change the lab number for each folder.

---

# Task 7 — Publish Your Website with GitHub Pages

GitHub Pages allows you to publish static HTML, CSS, and JavaScript websites directly from a GitHub repository.

<mark>For more detailed information, please refer to https://docs.github.com/en/pages/quickstart</mark>


## 7.1 Create a GitHub Repository

Log in to GitHub.

Create a repository named:

```text
stats401-labs
```

## 7.2 Initialize Git Locally

From your project folder:

```bash
git init
```

Add all files:

```bash
git add .
```

Commit:

```bash
git commit -m "Create STATS 401 lab website"
```

Set the main branch:

```bash
git branch -M main
```

Connect your repository:

```bash
git remote add origin https://github.com/YOUR_USERNAME/stats401-labs.git
```

Push:

```bash
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

## 7.3 Enable GitHub Pages

Go to:

```text
Repository
→ Settings
→ Pages
```

Under **Build and deployment**:

```text
Source:
Deploy from a branch
```

Select:

```text
Branch: main
Folder: / (root)
```

Save.

Your URL will normally have the form:

```text
https://YOUR_USERNAME.github.io/stats401-labs/
```

## 7.4 Updating Your Website

After making changes locally:

```bash
git add .
git commit -m "Update Lab 1"
git push
```

The workflow becomes:

```text
Edit locally
     ↓
Test locally
     ↓
git add
     ↓
git commit
     ↓
git push
     ↓
GitHub Pages
     ↓
Public website
```

---

# Assignment — My First D3 Visualization

## Objective

Create your first data-driven visualization using **D3.js** and publish it as **Lab 1** on your STATS 401 GitHub Pages website.

The goal is not to build a complex visualization. Instead, demonstrate that you understand the basic workflow:

```text
HTML
 ↓
CSS
 ↓
JavaScript
 ↓
D3
 ↓
External Data
 ↓
SVG Visualization
 ↓
GitHub
 ↓
GitHub Pages
```

## Dataset

Create `data/students.csv` containing:

```csv
name,score
Alice,85
Bob,72
Carol,91
David,66
Emma,88
Frank,74
Grace,95
Henry,82
```

## Visualization Task

Create a **Student Score Bar Chart** using D3.js.

- Each student should be represented by one bar.
- The **height of the bar** should represent the student's score.
- You **do not need to create x- or y-axes**.
- Under each bar, display the student's **name** and **score**.

Conceptually:

```text
                █
        █       █
█       █   █   █
█   █   █   █   █       █
█   █   █   █   █   █   █
█   █   █   █   █   █   █

85  72  91  66  88  74  95  82
Alice Bob Carol David Emma Frank Grace Henry
```

The exact appearance does not need to match this example.

---

## Assignment Requirements

### 1. Website Structure

Your website should include:

```text
stats401-labs/
│
├── index.html
├── css/
├── js/
├── data/
│   └── students.csv
├── lab1/
├── lab2/
├── lab3/
├── lab4/
├── lab5/
├── lab6/
├── lab7/
├── lab8/
├── lab9/
└── lab10/
```

### 2. Lab Navigation

Your main webpage must contain navigation links for **Lab 1 through Lab 10**.

Clicking **Lab 1** should open your completed visualization. Labs 2–10 may contain placeholder pages.

### 3. Load External Data

Load `students.csv` using D3:

```javascript
d3.csv("../data/students.csv")
```

Do not manually copy the dataset into your JavaScript file.

### 4. Convert Scores to Numbers

CSV values are initially strings. Convert `score` to a number:

```javascript
d3.csv("../data/students.csv", d => ({
    name: d.name,
    score: +d.score
}))
```

### 5. Use D3.js

Use D3 to create the visualization, including methods such as:

```javascript
d3.select(...)
.data(...)
.join(...)
.attr(...)
```

### 6. Use SVG

Create the visualization using SVG.

For example:

```javascript
const svg = d3.select("#chart")
    .append("svg");
```

### 7. Use D3 Data Binding

Create the bars from the dataset using D3 data binding:

```javascript
svg.selectAll("rect")
    .data(data)
    .join("rect");
```

Do not manually create eight separate rectangles.

### 8. Encode Score with Bar Height

The height of each bar must represent the student's score:

```text
Higher score → Taller bar
Lower score  → Shorter bar
```

### 9. Show Name and Score

Under each bar, clearly display the student's **name** and **score**.

### 10. Add a Title

Include a descriptive title, such as:

```text
Student Scores
```

### 11. Use CSS

Use CSS to make the webpage and visualization readable. Consider styling the page layout, navigation, typography, spacing, bars, and labels.

### 12. Publish with GitHub Pages

Your completed Lab 1 must be publicly accessible through GitHub Pages.

Example:

```text
https://yourusername.github.io/stats401-labs/lab1/
```

---

# Submission Requirements

Submit **one GitHub Pages link** that directly opens your Lab 1 assignment.

Example:

```text
https://yourusername.github.io/stats401-labs/lab1/
```

Do **not** submit a local URL such as `http://localhost:8000`.

---

# Submission Checklist

- [ ] My GitHub Pages website opens successfully.
- [ ] My website contains navigation for all 10 labs.
- [ ] Clicking Lab 1 opens my completed visualization.
- [ ] Labs 2–10 have placeholder pages.
- [ ] I use the provided `students.csv` dataset.
- [ ] My visualization loads the CSV file using D3.
- [ ] I convert `score` from a string to a number.
- [ ] My visualization uses D3.js.
- [ ] My visualization uses SVG.
- [ ] I use D3 data binding to create the bars.
- [ ] There is one bar for each student.
- [ ] Bar height represents the student's score.
- [ ] Each bar shows the student's name and score underneath.
- [ ] My visualization has a clear title.
- [ ] CSS makes the webpage and visualization readable.
- [ ] There are no major JavaScript errors in the browser console.
- [ ] The visualization works correctly on GitHub Pages.
- [ ] I submitted the direct GitHub Pages link to Lab 1.

By the end of the course, the website will serve as a portfolio containing all of your data acquisition and visualization work.
