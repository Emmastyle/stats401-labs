# Lab 10 --- Novel Interaction with Visualizations

**STATS 401: Data Acquisition and Visualization**

## Learning Objectives

By the end of this lab, you should be able to:

1.  Explain how novel input modalities can extend conventional
    visualization interaction.
2.  Use **voice commands** to control visualization functions.
3.  Use a **web camera and hand gestures** as visualization input.
4.  Understand how **webcam-based gaze estimation** can support visual
    exploration.
5.  Map novel inputs to familiar actions such as selection, filtering,
    zooming, highlighting, and navigation.
6.  Provide feedback, fallback controls, and appropriate privacy
    protections.

------------------------------------------------------------------------

# 0. From Mouse Interaction to Novel Interaction

Most visualizations use:

``` text
Mouse
Keyboard
Touch
```

Typical interactions include:

``` text
Click
Hover
Drag
Zoom
Brush
Filter
Search
```

The same visualization functions can also be controlled through:

``` text
Voice
Hand Gesture
Eye Gaze
```

For example:

``` text
"Show Asia"
      ↓
Voice Recognition
      ↓
Filter Visualization
```

or:

``` text
Open Palm
      ↓
Camera + Hand Tracking
      ↓
Reset Visualization
```

The important design question is:

> **Which visualization task can this input modality make easier or more
> natural?**

------------------------------------------------------------------------

# 1. Interaction Pipeline

Novel interaction usually follows:

``` text
User Action
    ↓
Sensor / Browser Input
    ↓
Recognition
    ↓
Interpretation
    ↓
Visualization Command
    ↓
D3 Update
    ↓
Visual Feedback
```

Separate the input method from the visualization function:

``` javascript
function highlightCountry(country) {

    d3.selectAll(".country")
        .classed(
            "selected",
            d =>
                d.properties.name
                === country
        );
}
```

The same function could be triggered by:

``` text
Mouse Click
Voice
Gesture
Gaze
```

------------------------------------------------------------------------

# Part I --- Voice Interaction

# Task 1 --- Browser Speech Recognition

Some browsers expose speech recognition through the Web Speech API.

``` javascript
const SpeechRecognition =
    window.SpeechRecognition
    ||
    window.webkitSpeechRecognition;
```

Check support:

``` javascript
if (!SpeechRecognition) {

    console.log(
        "Speech recognition is not supported."
    );
}
```

Create:

``` javascript
const recognition =
    new SpeechRecognition();

recognition.lang = "en-US";
recognition.continuous = false;
recognition.interimResults = false;
```

> Browser support varies. Keep conventional controls available as a
> fallback.

------------------------------------------------------------------------

# Task 2 --- Start Listening

HTML:

``` html
<button id="voice-button">
    Start Voice Control
</button>

<p id="voice-status">
    Voice control inactive
</p>
```

JavaScript:

``` javascript
d3.select("#voice-button")
    .on("click", function() {

        recognition.start();

        d3.select("#voice-status")
            .text("Listening...");
    });
```

The microphone should only activate after explicit user action and
permission.

------------------------------------------------------------------------

# Task 3 --- Read the Voice Command

``` javascript
recognition.onresult =
    function(event) {

        const transcript =
            event.results[0][0]
            .transcript
            .toLowerCase()
            .trim();

        d3.select("#voice-status")
            .text(
                `Heard: ${transcript}`
            );

        handleVoiceCommand(
            transcript
        );
    };
```

------------------------------------------------------------------------

# Task 4 --- Map Voice to Visualization Actions

``` javascript
function handleVoiceCommand(
    command
) {

    if (
        command.includes("reset")
    ) {

        resetVisualization();

    }

    else if (
        command.includes("show asia")
    ) {

        filterRegion("Asia");

    }

    else if (
        command.includes("show europe")
    ) {

        filterRegion("Europe");

    }

    else {

        showCommandError(
            command
        );
    }
}
```

Now:

``` text
"Show Asia"
→ filterRegion("Asia")

"Reset"
→ resetVisualization()
```

You can also support:

``` text
"Highlight Japan"
```

by extracting the country name and calling your existing
`highlightCountry()` function.

------------------------------------------------------------------------

# Task 5 --- Give Voice Feedback

Always show what the system heard:

``` text
Listening...

Heard:
"show asia"

Action:
Showing Asia
```

If recognition fails:

``` text
Command not recognized.

Try:
"Show Asia"
"Highlight Japan"
"Reset"
```

Users should not have to guess whether the system understood them.

------------------------------------------------------------------------

# Part II --- Camera-Based Hand Gesture Interaction

# Task 6 --- Access the Webcam

HTML:

``` html
<video
    id="camera"
    autoplay
    playsinline>
</video>
```

JavaScript:

``` javascript
const video =
    document.getElementById(
        "camera"
    );

const stream =
    await navigator
    .mediaDevices
    .getUserMedia({
        video: true
    });

video.srcObject =
    stream;
```

Provide:

``` text
Start Camera
Stop Camera
Camera Status
```

Do not activate the camera automatically.

------------------------------------------------------------------------

# Task 7 --- Hand Tracking

A browser-based hand-landmark library such as **MediaPipe Hand
Landmarker** can process webcam frames.

https://github.com/prashver/hand-landmark-recognition-using-mediapipe

Conceptually:

``` text
Camera Frame
     ↓
Hand Detector
     ↓
Hand Landmarks
     ↓
Gesture Recognition
     ↓
Visualization Action
```

Detected landmarks include locations such as:

``` text
Wrist
Thumb
Index Finger
Middle Finger
Ring Finger
Little Finger
```

These can be used to recognize simple gestures.

------------------------------------------------------------------------

# Task 8 --- Design a Small Gesture Vocabulary

Start with only a few gestures.

For example:

``` text
Open Palm
→ Reset

Swipe Left
→ Previous

Swipe Right
→ Next

Pinch
→ Select
```

For a temporal visualization:

``` text
Swipe Right
→ next time step

Swipe Left
→ previous time step
```

The goal is not to recognize many gestures. The goal is to use **a few
reliable gestures for meaningful visualization tasks**.

------------------------------------------------------------------------

# Task 9 --- Map Gestures to Actions

``` javascript
function handleGesture(
    gesture
) {

    if (
        gesture === "Open_Palm"
    ) {

        resetVisualization();

    }

    else if (
        gesture === "Pointing_Up"
    ) {

        showDetails();

    }

    else if (
        gesture === "Thumb_Up"
    ) {

        confirmSelection();
    }
}
```

Pipeline:

``` text
Camera
  ↓
Gesture Model
  ↓
Gesture Label
  ↓
handleGesture()
  ↓
D3 Update
```

------------------------------------------------------------------------

# Task 10 --- Prevent Repeated Commands

A camera may detect the same gesture many times per second.

Without control:

``` text
Open Palm
→ Reset
→ Reset
→ Reset
→ Reset
```

Use a cooldown:

``` javascript
let lastGestureTime = 0;

const cooldown = 1000;

function triggerGesture(
    gesture
) {

    const now =
        Date.now();

    if (
        now - lastGestureTime
        < cooldown
    ) {

        return;
    }

    lastGestureTime = now;

    handleGesture(
        gesture
    );
}
```

Also display:

``` text
Detected Gesture:
Swipe Right

Action:
Next Time Step
```

------------------------------------------------------------------------

# Part III --- Webcam-Based Eye Gaze

# Task 11 --- What Is Gaze Interaction?

Webcam-based gaze estimation attempts to estimate where the user is
looking on the screen.

https://webgazer.cs.brown.edu/

``` text
Webcam
  ↓
Face / Eye Features
  ↓
Gaze Estimation
  ↓
Estimated Screen Position
  ↓
Visualization Interaction
```

A browser library such as **WebGazer.js** can be used to experiment with
webcam-based gaze estimation.

Webcam gaze can be noisy, so use it for **approximate interaction**, not
precise selection.

------------------------------------------------------------------------

# Task 12 --- Show the Estimated Gaze Point

Suppose the gaze system returns:

``` javascript
function gazeListener(
    data
) {

    if (!data) {
        return;
    }

    updateGazeCursor(
        data.x,
        data.y
    );
}
```

Show the estimated position:

``` javascript
function updateGazeCursor(
    x,
    y
) {

    d3.select("#gaze-cursor")
        .style(
            "left",
            `${x}px`
        )
        .style(
            "top",
            `${y}px`
        );
}
```

Visible gaze feedback helps users understand estimation errors.

------------------------------------------------------------------------

# Task 13 --- Avoid the Midas Touch Problem

Do not select an item every time the user looks at it.

People naturally look around a visualization.

Instead use:

``` text
Gaze
+
Dwell Time
```

For example:

``` text
Look at item for 800 ms
→ highlight
```

Or combine modalities:

``` text
Gaze
+
Voice Confirmation
```

Example:

``` text
Look at Country
      +
Say "Select"
      ↓
Select Country
```

A useful principle is:

``` text
Gaze
→ indicate target

Voice / Click
→ confirm action
```

------------------------------------------------------------------------

# Assignment --- Add Novel Interaction to a Previous Visualization

## Objective

Choose **one visualization from Labs 1--9** and extend it with at least
**one novel interaction modality**.

Choose from:

``` text
Voice Interaction

Camera-Based Hand Gesture Interaction

Webcam-Based Eye Gaze Interaction
```

You may also combine multiple modalities.

------------------------------------------------------------------------

# Part A --- Choose a Previous Visualization

Examples:

``` text
Lab 2
Multivariate Scatterplot

Lab 5
Network Visualization

Lab 6
Tree / Treemap

Lab 7
Temporal Visualization

Lab 8
Semantic Embedding Map

Lab 9
Geospatial Visualization
```

Do not rebuild the entire visualization. Extend your existing
implementation.

------------------------------------------------------------------------

# Part B --- Implement at Least One Novel Interaction

Examples:

### Voice

``` text
"Show Europe"
→ filter

"Highlight China"
→ select

"Reset"
→ reset
```

### Hand Gesture

``` text
Swipe Right
→ next time step

Swipe Left
→ previous time step

Open Palm
→ reset
```

### Eye Gaze

``` text
Look at point
→ highlight

Dwell
→ show details
```

You may design your own interaction if the mapping to the visualization
task is clearly explained.

------------------------------------------------------------------------

# Part C --- Feedback and Fallback

Show what the system detects:

``` text
Voice:
"Heard: Show Europe"

Gesture:
"Detected: Swipe Right"

Gaze:
show estimated gaze position
```

Also provide a conventional fallback:

``` text
Mouse
Button
Keyboard
```

The visualization should remain usable when recognition fails or sensor
permission is unavailable.

------------------------------------------------------------------------

# Part E --- Design Reflection

Write approximately **100--200 words** explaining:

1.  Which previous visualization you extended.
2.  What novel interaction you implemented.
3.  What user task it supports.
4.  Why the interaction is appropriate for the task.
5.  What limitations or recognition errors you observed.

------------------------------------------------------------------------

# Assignment Requirements

1.  Reuse a visualization from previous Labs.
2.  Add at least one novel interaction.
3.  Use voice, hand gesture, gaze, or another justified novel modality.
4.  Connect the interaction to a specific visualization task.
5.  Provide visible recognition/action feedback.
6.  Provide conventional fallback controls.
7.  Require explicit user action before activating camera/microphone.
8.  Include a 100--200 word design reflection.
------------------------------------------------------------------------


# Submission Checklist

-   [ ] I reuse a visualization from a previous lab.
-   [ ] I implement at least one novel interaction.
-   [ ] The interaction supports a specific visualization task.
-   [ ] The interface provides visible feedback.
-   [ ] I provide conventional fallback controls.
-   [ ] Camera/microphone access requires explicit user action.
-   [ ] I explain how to use the interaction.
-   [ ] I include a 100--200 word design reflection.

------------------------------------------------------------------------

