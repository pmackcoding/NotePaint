(function () {

    const flexGapSupported = (() => {
        const flex = document.createElement("div");
        flex.style.display = "flex";
        flex.style.flexDirection = "column";
        flex.style.rowGap = "1px";

        flex.appendChild(document.createElement("div"));
        flex.appendChild(document.createElement("div"));

        document.body.appendChild(flex);

        const supported = flex.scrollHeight === 1;

        flex.parentNode.removeChild(flex);

        return supported;
    })();

    if (!flexGapSupported) {
        document.documentElement.classList.add("no-flex-gap");
    }


    const piano = document.getElementById("piano");

    // UNDO / REDO HISTORY

    const undoStack = [];
    const redoStack = [];
    const historyLimit = 50;

    const undoButton = document.getElementById("undo");
    const redoButton = document.getElementById("redo");

    function updateHistoryButtons() {
        undoButton.disabled = undoStack.length === 0;
        redoButton.disabled = redoStack.length === 0;
    }

    updateHistoryButtons();

    function capturePaintedNotes() {
        var keys = piano.querySelectorAll("[data-midi]");
        var snapshot = [];

        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];

            snapshot.push({
                manualColor:
                    key.getAttribute("data-manual-color") || undefined,

                enharmonicOverride:
                    key.getAttribute("data-enharmonic-override") || undefined,

                intervalOverride:
                    key.getAttribute("data-interval-override") || undefined,

                suppressedScaleNote:
                    key.getAttribute("data-suppressed-scale-note") || undefined
            });
        }

        return snapshot;
    }

    function saveUndoState() {
        undoStack.push(capturePaintedNotes());

        if (undoStack.length > historyLimit) {
            undoStack.shift();
        }

        redoStack.length = 0;
        updateHistoryButtons();
    }


    function transposeHistory(direction) {

        const shift = direction * 12;

        [undoStack, redoStack].forEach(function (stack) {

            stack.forEach(function (snapshot, index) {

                const movedSnapshot = Array(snapshot.length).fill(null);

                snapshot.forEach(function (note, noteIndex) {

                    if (note === null) return;

                    const destination = noteIndex + shift;

                    if (destination >= 0 && destination < snapshot.length) {
                        movedSnapshot[destination] = note;
                    }
                });

                stack[index] = movedSnapshot;

            });

        });

    }

    piano.classList.add("painted-note-names");

    const startNote = 21;  // A0
    const endNote = 108;   // C8

    // PIANO SAMPLE FILE LOOKUP

    const sampleNoteNames = [
        "C", "C#", "D", "D#", "E", "F",
        "F#", "G", "G#", "A", "A#", "B"
    ];

    function getPianoSamplePath(midi) {
        const note = sampleNoteNames[midi % 12];
        const octave = Math.floor(midi / 12) - 1;

        return "Piano MP3 Samples/" + note + octave + ".mp3";
    }

    const blackNotes = [1, 3, 6, 8, 10];
    const noteNames = [
        "C", "C♯", "D", "D♯", "E", "F",
        "F♯", "G", "G♯", "A", "A♯", "B"
    ];

    const MAJOR_KEY_NAMES = {
        0: ["C", "D", "E", "F", "G", "A", "B"],
        7: ["G", "A", "B", "C", "D", "E", "F♯"],
        2: ["D", "E", "F♯", "G", "A", "B", "C♯"],
        9: ["A", "B", "C♯", "D", "E", "F♯", "G♯"],
        4: ["E", "F♯", "G♯", "A", "B", "C♯", "D♯"],
        11: ["B", "C♯", "D♯", "E", "F♯", "G♯", "A♯"],
        6: ["F♯", "G♯", "A♯", "B", "C♯", "D♯", "E♯"],
        5: ["F", "G", "A", "B♭", "C", "D", "E"],
        10: ["B♭", "C", "D", "E♭", "F", "G", "A"],
        3: ["E♭", "F", "G", "A♭", "B♭", "C", "D"],
        8: ["A♭", "B♭", "C", "D♭", "E♭", "F", "G"],
        1: ["D♭", "E♭", "F", "G♭", "A♭", "B♭", "C"]
    };

    function getNoteName(noteIndex) {
        if (selectedRoot !== null) {
            const interval = (noteIndex - selectedRoot + 12) % 12;
            const degree = DIATONIC.indexOf(interval);

            if (degree !== -1) {
                return MAJOR_KEY_NAMES[selectedRoot][degree];
            }
        }

        return noteNames[noteIndex];
    }

    function refreshNoteNames() {
        const intervalsSelected =
            noteNamesChoice &&
            noteNamesChoice.value === "intervals";

        const intervalRoot = getIntervalRoot();
        const keys = piano.querySelectorAll("[data-midi]");

        for (var i = 0; i < keys.length; i++) {
            const key = keys[i];

            const midi = Number(key.getAttribute("data-midi"));
            const noteIndex = midi % 12;
            const octave = Math.floor(midi / 12) - 1;

            if (intervalsSelected && intervalRoot !== null) {

                const distance =
                    (noteIndex - intervalRoot + 12) % 12;

                const override =
                    key.getAttribute("data-interval-override");

                key.textContent =
                    override || INTERVAL_NAMES[distance];

            } else {

                const manualColor =
                    key.getAttribute("data-manual-color");

                const override =
                    key.getAttribute("data-enharmonic-override");

                key.textContent =
                    (manualColor !== null && override
                        ? override
                        : getNoteName(noteIndex)) + octave;
            }
        }

        updateIntervalHint();
    }

    // INTERVAL LABELS

    const INTERVAL_NAMES = [
        "1", "♭2", "2", "♭3",
        "3", "4", "♭5", "5",
        "♭6", "6", "♭7", "7"
    ];

    const INTERVAL_ALTERNATIVES = {
        1: ["♭2", "♯1"],
        3: ["♭3", "♯2"],
        4: ["3", "♭4"],
        6: ["♭5", "♯4"],
        8: ["♭6", "♯5"],
        10: ["♭7", "♯6"],
        11: ["7", "♭1"]
    };

    function getIntervalRoot() {


        if (selectedRoot !== null) {
            return scaleMode === "minor"
                ? (selectedRoot + 9) % 12
                : selectedRoot;
        }


        if (showRoots) {
            return manualRootNote;
        }


        return null;
    }

    function getIntervalName(noteIndex) {
        const root = getIntervalRoot();

        if (root === null) return null;

        const distance = (noteIndex - root + 12) % 12;

        return INTERVAL_NAMES[distance];
    }

    const ENHARMONIC_NAMES = {
        1: ["C♯", "D♭"],
        3: ["D♯", "E♭"],
        6: ["F♯", "G♭"],
        8: ["G♯", "A♭"],
        10: ["A♯", "B♭"]
    };

    function toggleEnharmonicName(key) {
        if (noteNamesChoice.value === "intervals" &&
            getIntervalRoot() !== null) {
            toggleIntervalName(key);
            return;
        }
        if (key.dataset.manualColor === undefined) return;

        const midi = Number(key.dataset.midi);
        const noteIndex = midi % 12;
        const alternatives = ENHARMONIC_NAMES[noteIndex];

        if (!alternatives) return;
        saveUndoState();

        const octave = Math.floor(midi / 12) - 1;
        const currentName =
            key.dataset.enharmonicOverride || getNoteName(noteIndex);

        const newName = currentName === alternatives[1]
            ? alternatives[0]
            : alternatives[1];

        key.dataset.enharmonicOverride = newName;
        key.textContent = newName + octave;
    }

    function toggleIntervalName(key) {


        const root = getIntervalRoot();
        if (root === null) return;

        const noteIndex = Number(key.dataset.midi) % 12;
        const distance = (noteIndex - root + 12) % 12;

        const alternatives = INTERVAL_ALTERNATIVES[distance];
        if (!alternatives) return;
        saveUndoState();

        if (key.dataset.manualColor === undefined) {
            key.dataset.manualColor = currentColor;
            key.dataset.color = currentColor;
        }



        const currentName =
            key.dataset.intervalOverride || INTERVAL_NAMES[distance];

        key.dataset.intervalOverride =
            currentName === alternatives[1]
                ? alternatives[0]
                : alternatives[1];

        refreshNoteNames();


        key.textContent = key.dataset.intervalOverride;

    }

    let longPressTimer = null;
    let longPressTriggered = false;
    let longPressStartX = 0;
    let longPressStartY = 0;

    function cancelLongPress() {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }

    function startLongPress(event, key) {
        if (event.touches.length !== 1) return;


        if (key.dataset.manualColor === undefined) return;

        const noteIndex = Number(key.dataset.midi) % 12;


        if (noteNamesChoice.value === "intervals" &&
            getIntervalRoot() !== null) {

            const distance = (noteIndex - getIntervalRoot() + 12) % 12;

            if (!INTERVAL_ALTERNATIVES[distance]) return;

        } else {

            if (!ENHARMONIC_NAMES[noteIndex]) return;

        }

        longPressTriggered = false;

        longPressStartX = event.touches[0].clientX;
        longPressStartY = event.touches[0].clientY;

        cancelLongPress();

        longPressTimer = setTimeout(function () {
            toggleEnharmonicName(key);
            longPressTriggered = true;
            longPressTimer = null;
        }, 500);
    }

    function moveLongPress(event) {
        if (longPressTimer === null) return;

        if (event.touches.length !== 1) {
            cancelLongPress();
            return;
        }

        const distanceX = Math.abs(
            event.touches[0].clientX - longPressStartX
        );

        const distanceY = Math.abs(
            event.touches[0].clientY - longPressStartY
        );

        if (distanceX > 10 || distanceY > 10) {
            cancelLongPress();
        }
    }

    let whiteKeyCount = 0;

    for (let midi = startNote; midi <= endNote; midi++) {
        const key = document.createElement("div");
        key.dataset.midi = midi;

        const noteIndex = midi % 12;
        const octave = Math.floor(midi / 12) - 1;

        if (blackNotes.includes(noteIndex)) {
            key.classList.add("black-key");
            key.style.left = `calc(12px + ${whiteKeyCount} * 3.5rem)`;

        } else {
            key.classList.add("white-key");

            whiteKeyCount++;
        }

        key.textContent = `${noteNames[noteIndex]}${octave}`;

        key.addEventListener("touchstart", function (event) {
            startLongPress(event, key);
        }, { passive: true });

        key.addEventListener("touchmove", moveLongPress, {
            passive: true
        });

        key.addEventListener("touchend", cancelLongPress);
        key.addEventListener("touchcancel", cancelLongPress);

        key.addEventListener("click", function (event) {



            if (longPressTriggered) {
                longPressTriggered = false;
                event.preventDefault();
                return;
            }

            if (event.altKey) {
                event.preventDefault();

                if (noteNamesChoice.value === "intervals" &&
                    getIntervalRoot() !== null) {


                    toggleIntervalName(key);
                    return;
                }

                const noteIndex = Number(key.dataset.midi) % 12;

                if (key.dataset.manualColor === undefined &&
                    ENHARMONIC_NAMES[noteIndex]) {

                    saveUndoState();

                    key.dataset.manualColor = currentColor;
                    key.dataset.color = currentColor;


                    key.dataset.enharmonicOverride =
                        ENHARMONIC_NAMES[noteIndex][1];

                    refreshNoteNames();

                } else {
                    toggleEnharmonicName(key);
                }

                return;
            }

            saveUndoState();

            if (key.dataset.color === currentColor) {
                if (key.dataset.scaleNote !== undefined) {
                    key.dataset.suppressedScaleNote = "true";
                }
                delete key.dataset.color;
                delete key.dataset.manualColor;
                delete key.dataset.enharmonicOverride;
                key.classList.remove("root-note");

            } else {
                key.dataset.manualColor = currentColor;
                key.dataset.color = currentColor;

                playPianoNote(midi);
            }
            refreshNoteNames();
            refreshPianoRootHighlights();
        });


        piano.appendChild(key);
    }

    function restorePaintedNotes(snapshot) {
        var keys = piano.querySelectorAll("[data-midi]");

        var properties = [
            ["manualColor", "data-manual-color"],
            ["enharmonicOverride", "data-enharmonic-override"],
            ["intervalOverride", "data-interval-override"],
            ["suppressedScaleNote", "data-suppressed-scale-note"]
        ];

        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var saved = snapshot[i];

            if (!saved) continue;

            for (var j = 0; j < properties.length; j++) {
                var property = properties[j][0];
                var attribute = properties[j][1];

                if (saved[property] === undefined) {
                    key.removeAttribute(attribute);
                } else {
                    key.setAttribute(attribute, saved[property]);
                }
            }

            var manualColor = key.getAttribute("data-manual-color");

            if (manualColor !== null) {
                key.setAttribute("data-color", manualColor);

            } else if (
                key.hasAttribute("data-scale-note") &&
                !key.hasAttribute("data-suppressed-scale-note")
            ) {
                key.setAttribute("data-color", "blue");

            } else {
                key.removeAttribute("data-color");
            }
        }

        refreshNoteNames();
        refreshPianoRootHighlights();
    }

    function undoPainting() {
        if (undoStack.length === 0) return;

        redoStack.push(capturePaintedNotes());

        const previousState = undoStack.pop();



        restorePaintedNotes(previousState);

        updateHistoryButtons();
    }

    function redoPainting() {
        if (redoStack.length === 0) return;

        undoStack.push(capturePaintedNotes());

        const nextState = redoStack.pop();
        restorePaintedNotes(nextState);

        updateHistoryButtons();
    }

    undoButton.addEventListener("click", undoPainting);
    redoButton.addEventListener("click", redoPainting);

    const pianoScroll = document.getElementById("piano-scroll");



    let printScrollLeft = 0;

    window.addEventListener("beforeprint", function () {
        printScrollLeft = pianoScroll.scrollLeft;

        const maxScroll = pianoScroll.scrollWidth - pianoScroll.clientWidth;
        const atRightEnd = maxScroll > 0 &&
            maxScroll - printScrollLeft <= 2;

        if (atRightEnd) {
            const printWidth = 267 / 25.4 * 96;

            printScrollLeft = Math.max(
                0,
                pianoScroll.scrollWidth - printWidth
            );
        }

        pianoScroll.scrollLeft = 0;

        piano.style.setProperty(
            "--print-scroll-left",
            printScrollLeft + "px"
        );
    });

    window.addEventListener("afterprint", function () {
        piano.style.removeProperty("--print-scroll-left");

        pianoScroll.scrollLeft = printScrollLeft;
    });

    const initialWhiteKey = 16;
    let initialPianoScroll = 0;

    window.requestAnimationFrame(function () {
        pianoScroll.scrollLeft = initialWhiteKey * 3.5 *
            parseFloat(getComputedStyle(document.documentElement).fontSize);

        initialPianoScroll = pianoScroll.scrollLeft;
    });

    const centrePianoButton = document.getElementById("centre-piano");

    centrePianoButton.addEventListener("click", function () {
        pianoScroll.scrollTo({
            left: initialPianoScroll,
            behavior: "smooth"
        });
    });

    const clearButton = document.getElementById("clear-piano");

    clearButton.addEventListener("click", function () {
        const hasManualNotes = piano.querySelector("[data-manual-color]");

        if (hasManualNotes) {
            saveUndoState();
        }

        const paintedKeys = document.querySelectorAll("#piano [data-color]");

        paintedKeys.forEach(function (key) {
            delete key.dataset.color;
            delete key.dataset.manualColor;
            delete key.dataset.scaleNote;
            delete key.dataset.enharmonicOverride;
            key.classList.remove("root-note");
        });

        selectedRoot = null;



        keySegments.forEach(function (segment) {
            segment.classList.remove("selected");
        });
        refreshNoteNames();
    });

    // OCTAVE TRANSPOSITION

    const octaveDown = document.getElementById("octave-down");
    const octaveUp = document.getElementById("octave-up");
    const octaveLabel = document.getElementById("octave-label");

    let octaveOffset = 0;
    function updateOctaveLabel() {
        octaveLabel.textContent = "Octave";

        octaveLabel.classList.toggle(
            "transposed",
            octaveOffset !== 0
        );
    }

    updateOctaveLabel();

    function moveOctave(direction) {
        const paintedKeys = Array.from(
            piano.querySelectorAll("[data-color]")
        );


        if (paintedKeys.length === 0) {
            const nextOffset = octaveOffset + direction;

            if (nextOffset < -3 || nextOffset > 3) return;

            octaveOffset = nextOffset;

            updateOctaveLabel();

            return;
        }



        const canMove = paintedKeys.every(function (key) {
            const destination = Number(key.dataset.midi) + direction * 12;
            return destination >= startNote && destination <= endNote;
        });

        if (!canMove) return;


        const notes = paintedKeys.map(function (key) {
            return {
                midi: Number(key.dataset.midi),
                color: key.dataset.color,
                manualColor: key.dataset.manualColor,
                scaleNote: key.dataset.scaleNote,
                enharmonicOverride: key.dataset.enharmonicOverride,
                root: key.classList.contains("root-note")
            };
        });

        paintedKeys.forEach(function (key) {
            delete key.dataset.color;
            delete key.dataset.manualColor;
            delete key.dataset.scaleNote;
            delete key.dataset.enharmonicOverride;
            key.classList.remove("root-note");

        });

        notes.forEach(function (note) {
            const destination = piano.querySelector(
                `[data-midi="${note.midi + direction * 12}"]`
            );

            destination.dataset.color = note.color;
            if (note.manualColor !== undefined) {
                destination.dataset.manualColor = note.manualColor;
            }

            if (note.enharmonicOverride !== undefined) {
                destination.dataset.enharmonicOverride = note.enharmonicOverride;
            }

            if (note.scaleNote !== undefined) {
                destination.dataset.scaleNote = note.scaleNote;
            }

            if (note.root) {
                destination.classList.add("root-note");
            }
        });

        transposeHistory(direction);

        octaveOffset += direction;
        updateOctaveLabel();
        refreshNoteNames();
    }



    octaveDown.addEventListener("click", function () {
        moveOctave(-1);
    });

    octaveUp.addEventListener("click", function () {
        moveOctave(1);
    });


    octaveLabel.addEventListener("click", function () {
        while (octaveOffset !== 0) {
            const previousOffset = octaveOffset;

            moveOctave(octaveOffset > 0 ? -1 : 1);

            if (octaveOffset === previousOffset) {
                break;
            }
        }
    });


    const noteNamesButton = document.getElementById("toggle-note-names");
    const noteNamesChoiceRow = document.getElementById("note-names-choice-row");

    let noteNamesVisible = false;

    noteNamesButton.addEventListener("click", function () {

        noteNamesVisible = !noteNamesVisible;

        piano.classList.toggle("hide-note-names", !noteNamesVisible);

        noteNamesButton.setAttribute("aria-pressed", String(noteNamesVisible));
        noteNamesButton.setAttribute("aria-expanded", String(noteNamesVisible));

        noteNamesChoiceRow.hidden = !noteNamesVisible;

    });

    const noteNamesChoice = document.getElementById("note-names-choice");

    const intervalHint = document.getElementById("interval-hint");

    function updateIntervalHint() {
        intervalHint.hidden =
            noteNamesChoice.value !== "intervals" ||
            getIntervalRoot() !== null;
    }

    noteNamesChoice.addEventListener("change", function () {
        piano.classList.toggle(
            "painted-note-names",
            noteNamesChoice.value === "painted" ||
            noteNamesChoice.value === "intervals"
        );

        refreshNoteNames();
    });

    const paletteColors = document.querySelectorAll(".palette-color");

    let currentColor = "blue";

    paletteColors.forEach(function (color) {

        color.addEventListener("click", function () {

            paletteColors.forEach(function (button) {
                button.classList.remove("active");
            });

            color.classList.add("active");

            currentColor = color.dataset.color;

        });

    });

    // KEYBOARD PALETTE CONTROLS

    document.addEventListener("keydown", function (event) {

        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
            return;
        }

        if (event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }

        const activeElement = document.activeElement;

        if (
            activeElement.tagName === "INPUT" ||
            activeElement.tagName === "SELECT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.isContentEditable
        ) {
            return;
        }

        event.preventDefault();

        const colors = Array.from(paletteColors);

        const currentIndex = colors.findIndex(function (color) {
            return color.dataset.color === currentColor;
        });

        const direction = event.key === "ArrowRight" ? 1 : -1;

        const nextIndex =
            (currentIndex + direction + colors.length) % colors.length;

        colors[nextIndex].click();

    });

    // KEYBOARD UNDO / REDO

    document.addEventListener("keydown", function (event) {

        if (!(event.metaKey || event.ctrlKey)) return;
        if (event.altKey) return;
        if (event.key.toLowerCase() !== "z") return;

        const activeElement = document.activeElement;

        if (
            activeElement.tagName === "INPUT" ||
            activeElement.tagName === "SELECT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.isContentEditable
        ) {
            return;
        }

        event.preventDefault();

        if (event.shiftKey) {
            redoPainting();
        } else {
            undoPainting();
        }

    });

    // CIRCLE OF FIFTHS AND SCALES

    const DIATONIC = [0, 2, 4, 5, 7, 9, 11];
    const PENTATONIC = [0, 2, 4, 7, 9];

    let selectedRoot = null;
    let currentScale = DIATONIC;
    let showRoots = false;

    // INDEPENDENT ROOT SELECTOR

    const rootsButton = document.getElementById("toggle-roots");
    const pianoRootChoiceRow = document.getElementById("piano-root-choice-row");
    const pianoRootChoice = document.getElementById("piano-root-choice");

    let manualRootNote = 0;
    let keyRootChoice = "major";

    const ROOT_NOTE_LABELS = [
        "C", "C♯ / D♭", "D", "D♯ / E♭",
        "E", "F", "F♯ / G♭", "G",
        "G♯ / A♭", "A", "A♯ / B♭", "B"
    ];



    ROOT_NOTE_LABELS.forEach(function (name, note) {
        pianoRootChoice.add(new Option(name, String(note)));
    });

    pianoRootChoice.value = String(manualRootNote);

    pianoRootChoice.addEventListener("change", function () {

        manualRootNote = Number(pianoRootChoice.value);


        piano.querySelectorAll("[data-interval-override]").forEach(function (key) {
            delete key.dataset.intervalOverride;
        });

        refreshPianoRootHighlights();
        refreshNoteNames();

    });

    // SHOW ROOTS BUTTON

    rootsButton.addEventListener("click", function () {

        showRoots = !showRoots;

        rootsButton.setAttribute("aria-pressed", String(showRoots));
        rootsButton.setAttribute("aria-expanded", String(showRoots));

        pianoRootChoiceRow.hidden =
            !showRoots || selectedRoot !== null;

        paintScale();

    });

    // INDEPENDENT ROOT HIGHLIGHTING

    function refreshPianoRootHighlights() {

        var rootNote;

        if (selectedRoot === null) {
            rootNote = manualRootNote;
        } else {
            rootNote = scaleMode === "minor"
                ? (selectedRoot + 9) % 12
                : selectedRoot;
        }


        var oldRoots = piano.querySelectorAll(".root-note");

        for (var i = 0; i < oldRoots.length; i++) {
            oldRoots[i].classList.remove("root-note");
        }

        if (!showRoots) return;

        var colouredKeys = piano.querySelectorAll("[data-midi][data-color]");

        for (var j = 0; j < colouredKeys.length; j++) {

            var key = colouredKeys[j];
            var note = Number(key.getAttribute("data-midi")) % 12;

            if (note === rootNote) {
                key.classList.add("root-note");
            }
        }
    }
    // MAJOR / RELATIVE MINOR MODE

    const rootChoice = document.getElementById("root-choice");

    let scaleMode = "major";

    rootChoice.addEventListener("change", function () {
        scaleMode = rootChoice.value;
        paintScale();
        refreshNoteNames();
    });

    const keySegments = document.querySelectorAll(".key-segment");
    const scaleOptions = document.querySelectorAll(".scale-option");
    const keyWheel = document.querySelector(".key-wheel");
    let currentWheelPosition = 0;

    function rotateWheel(segment) {

        const targetPosition = Number(segment.style.getPropertyValue("--i"));

        let difference = targetPosition - (currentWheelPosition % 12);

        if (difference > 6) difference -= 12;
        if (difference < -6) difference += 12;

        currentWheelPosition += difference;

        keyWheel.style.setProperty("--wheel-rotation", currentWheelPosition);
    }

    function clearScale() {
        piano.querySelectorAll("[data-scale-note]").forEach(function (key) {
            delete key.dataset.scaleNote;

            if (key.dataset.manualColor !== undefined) {
                key.dataset.color = key.dataset.manualColor;
            } else {
                delete key.dataset.color;
            }

            key.classList.remove("root-note");
        });
    }

    function paintScale() {
        clearScale();


        piano.querySelectorAll("[data-suppressed-scale-note]").forEach(function (key) {
            delete key.dataset.suppressedScaleNote;
        });


        piano.querySelectorAll("[data-interval-override]").forEach(function (key) {
            delete key.dataset.intervalOverride;
        });

        refreshNoteNames();

        if (selectedRoot === null) {
            refreshPianoRootHighlights();
            return;
        }


        const rootCandidates = [];

        for (let midi = startNote; midi <= endNote - 12; midi++) {
            if (midi % 12 === selectedRoot) {
                rootCandidates.push(midi);
            }
        }

        const middleRoot = rootCandidates.reduce(function (closest, midi) {
            return Math.abs(midi - 60) < Math.abs(closest - 60) ? midi : closest;
        });


        const modeAdjustment = scaleMode === "minor" ? -3 : 0;

        let octaveStart = middleRoot + modeAdjustment + octaveOffset * 12;


        while (octaveStart < startNote) {
            octaveStart += 12;
            octaveOffset++;
        }

        while (octaveStart + 12 > endNote) {
            octaveStart -= 12;
            octaveOffset--;
        }

        updateOctaveLabel();

        const octaveEnd = octaveStart + 12;

        piano.querySelectorAll("[data-midi]").forEach(function (key) {

            const midi = Number(key.dataset.midi);

            if (midi < octaveStart || midi > octaveEnd) return;

            const interval = (midi - octaveStart) % 12;

            const scaleIntervals = scaleMode === "minor"
                ? currentScale.map(function (note) {
                    return (note + 3) % 12;
                })
                : currentScale;

            if (scaleIntervals.includes(interval) || midi === octaveEnd) {
                key.dataset.scaleNote = "true";
                key.dataset.color = key.dataset.manualColor || "blue";

                if (showRoots && (midi === octaveStart || midi === octaveEnd)) {
                    key.classList.add("root-note");
                }
            }
        });

        refreshPianoRootHighlights();

    }





    // SELECT ROOT FROM CIRCLE OF FIFTHS

    keySegments.forEach(function (segment) {

        segment.addEventListener("click", function () {

            const root = Number(segment.dataset.root);

            if (selectedRoot === root) {
                selectedRoot = null;
            } else {
                selectedRoot = root;
            }

            keySegments.forEach(function (button) {
                button.classList.remove("selected");
            });

            if (selectedRoot !== null) {
                segment.classList.add("selected");
                rotateWheel(segment);
            }

            pianoRootChoiceRow.hidden =
                !showRoots || selectedRoot !== null;

            refreshNoteNames();
            paintScale();
        });
    });

    // SELECT PENTATONIC OR DIATONIC

    scaleOptions.forEach(function (option) {

        option.addEventListener("click", function () {

            scaleOptions.forEach(function (button) {
                button.classList.remove("selected");
            });

            option.classList.add("selected");

            currentScale = option.dataset.scale === "pentatonic"
                ? PENTATONIC
                : DIATONIC;

            paintScale();
        });
    });

    // SOUND CONTROLS

    const soundBtn = document.getElementById("sound-btn");
    const volumeSlider = document.getElementById("volume-slider");

    // PIANO SAMPLE AUDIO ENGINE

    const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

    let pianoAudioContext = null;
    let pianoMasterGain = null;

    const pianoSamples = {};

    function initialisePianoAudio() {
        if (pianoAudioContext) return;

        pianoAudioContext = new AudioContextClass();

        pianoMasterGain = pianoAudioContext.createGain();
        pianoMasterGain.gain.value = volume;
        pianoMasterGain.connect(pianoAudioContext.destination);
    }

    async function loadPianoSamples() {
        initialisePianoAudio();

        const loadingPromises = [];

        for (let midi = startNote; midi <= endNote; midi++) {
            loadingPromises.push(
                fetch(getPianoSamplePath(midi).replace(/#/g, "%23").replace(/ /g, "%20"))
                    .then(function (response) {
                        if (!response.ok) {
                            throw new Error("Sample not found: " + response.url);
                        }

                        return response.arrayBuffer();
                    })
                    .then(function (audioData) {
                        return new Promise(function (resolve, reject) {
                            pianoAudioContext.decodeAudioData(
                                audioData,
                                resolve,
                                reject
                            );
                        });
                    })
                    .then(function (buffer) {
                        pianoSamples[midi] = buffer;
                    })
            );
        }

        await Promise.all(loadingPromises);

       
    }

    function playPianoNote(midi) {
        if (isMuted || !pianoAudioContext || !pianoSamples[midi]) {
            return;
        }

        const source = pianoAudioContext.createBufferSource();

        source.buffer = pianoSamples[midi];
        source.connect(pianoMasterGain);
        source.start();
    }

    let isMuted = true;
    let volume = 0.15;

    const speakerShape = `
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
`;

    const soundOnIcon = `
    <svg viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true" focusable="false">
        ${speakerShape}
        <path d="M15 8a6 6 0 0 1 0 8" />
        <path d="M18 5a10 10 0 0 1 0 14" />
    </svg>
`;

    const soundOffIcon = `
    <svg viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true" focusable="false">
        ${speakerShape}
        <path d="m16 9 5 6m0-6-5 6" />
    </svg>
`;

    function updateSoundButton() {
        soundBtn.classList.toggle("on", !isMuted);
        soundBtn.classList.toggle("off", isMuted);

        soundBtn.innerHTML = `
        ${isMuted ? soundOffIcon : soundOnIcon}
        <span>${isMuted ? "Sound Off" : "Sound On"}</span>
    `;

        soundBtn.setAttribute("aria-pressed", String(!isMuted));
    }

    updateSoundButton();

    // SOUND ON / OFF

    soundBtn.addEventListener("click", async function () {
        isMuted = !isMuted;
        updateSoundButton();

        if (pianoMasterGain) {
            pianoMasterGain.gain.value = isMuted ? 0 : volume;
        }

        if (!isMuted) {
            try {
                initialisePianoAudio();

                if (pianoAudioContext.state === "suspended") {
                    await pianoAudioContext.resume();
                }

                if (Object.keys(pianoSamples).length !== 88) {
                    await loadPianoSamples();
                }

                
            } catch (error) {
                console.error("Could not load piano audio:", error);
                isMuted = true;
                updateSoundButton();
            }
        }
    });

    volumeSlider.value = volume;

    // PIANO VOLUME CONTROL

    volumeSlider.addEventListener("input", function () {
        volume = Number(volumeSlider.value);

        if (volume === 0) {
            isMuted = true;
        } else {
            isMuted = false;
        }

        updateSoundButton();

        volumeSlider.style.setProperty(
            "--volume-fill",
            `${(volume / Number(volumeSlider.max)) * 100}%`
        );

        if (pianoMasterGain) {
            pianoMasterGain.gain.value = isMuted ? 0 : volume;
        }
    });

    // KEYBOARD VOLUME CONTROLS

    document.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
            return;
        }

        const step = Number(volumeSlider.step) || 0.01;
        const min = Number(volumeSlider.min);
        const max = Number(volumeSlider.max);

        if (event.key === "ArrowUp") {
            volume = Math.min(max, volume + step);
        } else {
            volume = Math.max(min, volume - step);
        }

        volume = Number(volume.toFixed(2));

        volumeSlider.value = volume;


        volumeSlider.dispatchEvent(new Event("input", { bubbles: true }));

        event.preventDefault();
    });

    volumeSlider.style.setProperty(
        "--volume-fill",
        `${(volume / Number(volumeSlider.max)) * 100}%`
    );

    window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
            document.documentElement.classList.add("ready");
        });
    });

    // APPEARANCE CUSTOMISATION //


    const originalPageColor = "#edd69d";
    const originalBoardColor = "#5a3a1a";
    const originalPageBackground =
        "linear-gradient(to bottom, #edd69dd8, #d98e62e8)";

    const themeStorageKey = "notepaint-piano-theme";

    function updateLowerLabelColor(background) {
        const colors = background.match(
            /#[0-9a-f]{6}(?:[0-9a-f]{2})?|rgba?\([^)]+\)/gi
        );

        if (!colors) return;

        const color = colors[colors.length - 1];

        let r, g, b;

        if (color.startsWith("#")) {
            r = parseInt(color.slice(1, 3), 16);
            g = parseInt(color.slice(3, 5), 16);
            b = parseInt(color.slice(5, 7), 16);
        } else {
            const values = color.match(/[\d.]+/g);

            r = Number(values[0]);
            g = Number(values[1]);
            b = Number(values[2]);
        }

        const brightness = (r * 299 + g * 587 + b * 114) / 1000;

        const textColor = brightness < 80
            ? "#edd69d"
            : "#4b2e1e";

        document.body.style.setProperty("--lower-label-color", textColor);
    }


    const pageColorPicker = document.getElementById("page-color-picker");
    const boardColorPicker = document.getElementById("board-color-picker");
    const resetAppearanceBtn = document.getElementById("reset-appearance");
    const boardElement = document.getElementById("piano");


    function saveTheme() {
        const theme = {
            pageBackground: document.body.style.background,
            boardBackground: boardElement.style.background,
            pagePicker: pageColorPicker.value,
            boardPicker: boardColorPicker.value
        };


        try {
            localStorage.setItem(themeStorageKey, JSON.stringify(theme));
        } catch (error) {
            console.warn("Could not save theme:", error);
        }
    }


    function restoreTheme() {
        try {
            const saved = localStorage.getItem(themeStorageKey);
            if (!saved) return;

            const theme = JSON.parse(saved);
            if (!theme || typeof theme !== "object") return;

            if (typeof theme.pageBackground === "string" &&
                CSS.supports("background", theme.pageBackground)) {
                document.body.style.background = theme.pageBackground;
                updateLowerLabelColor(theme.pageBackground);
            }

            if (typeof theme.boardBackground === "string" &&
                CSS.supports("background", theme.boardBackground)) {
                boardElement.style.background = theme.boardBackground;
            }

            if (/^#[0-9a-f]{6}$/i.test(theme.pagePicker)) {
                pageColorPicker.value = theme.pagePicker;
            }

            if (/^#[0-9a-f]{6}$/i.test(theme.boardPicker)) {
                boardColorPicker.value = theme.boardPicker;
            }
        } catch (error) {
            console.warn("Could not restore theme:", error);
        }
    }

    function changePageColor(color) {
        document.body.style.background = color;
        pageColorPicker.value = originalPageColor;
        updateLowerLabelColor(color);
    }

    function changeCustomPageColor(color) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        function shade(value, amount) {
            return Math.round(value + (255 - value) * amount);
        }

        function toHex(value) {
            return value.toString(16).padStart(2, "0");
        }

        const lighter = "#" +
            toHex(shade(r, 0.65)) +
            toHex(shade(g, 0.65)) +
            toHex(shade(b, 0.65));

        const darker = "#" +
            toHex(Math.round(r * 0.8)) +
            toHex(Math.round(g * 0.8)) +
            toHex(Math.round(b * 0.8));

        document.body.style.background =
            `linear-gradient(to bottom, ${lighter}, ${darker})`;

        updateLowerLabelColor(darker);
    }


    function changeBoardColor(color) {
        boardElement.style.background = color;
    }


    document.querySelectorAll(".appearance-swatch").forEach(swatch => {
        swatch.addEventListener("click", () => {
            const color = swatch.dataset.color;
            const target = swatch.dataset.target;

            if (target === "page") {
                changePageColor(color);
            }

            if (target === "board") {
                changeBoardColor(color);
                boardColorPicker.value = originalBoardColor;
            }

            saveTheme();
        });
    });

    pageColorPicker.addEventListener("input", () => {
        changeCustomPageColor(pageColorPicker.value);
        saveTheme();
    });


    boardColorPicker.addEventListener("input", () => {
        changeBoardColor(boardColorPicker.value);
        saveTheme();
    });


    resetAppearanceBtn.addEventListener("click", () => {
        document.body.style.background = originalPageBackground;
        boardElement.style.background = originalBoardColor;

        updateLowerLabelColor(originalPageBackground);

        pageColorPicker.value = originalPageColor;
        boardColorPicker.value = originalBoardColor;

        try {
            localStorage.removeItem(themeStorageKey);
        } catch (error) {
            console.warn("Could not clear saved theme:", error);
        }
    });


    restoreTheme();

   

    // HELP TOUR

    const helpSteps = [
        {
            target: "#piano-scroll",
            title: "Paint the piano",
            text: "Click or tap a piano key to paint it in your chosen colour. Click with the same colour again to remove it, or choose another colour to recolour it.\n\nScroll sideways to explore the full 88-key keyboard."
        },
        {
            target: "#centre-piano",
            title: "Centre the piano",
            text: "Use this button to return the keyboard to its starting position after scrolling."
        },
        {
            target: "#circle-of-fifths",
            title: "Choose a key",
            text: "Choose a major key or its relative minor to display the scale notes. Select the same key again to switch them off.\n\nYour manually painted notes are preserved."
        },
        {
            target: "#scale-selector-container",
            title: "Choose your scale",
            text: "Switch between pentatonic and diatonic scales to explore different collections of notes.\n\nThe displayed scale updates automatically when a key is selected."
        },
        {
            target: "#octave-controls",
            title: "Explore the octaves",
            text: "Use the left and right arrows to move the displayed scale notes down or up an octave.\n\nSelect Octave to return to the original position."
        },
        {
            target: "#palette",
            title: "Choose a colour",
            text: "Choose the colour for your next painted note. Use different colours to mark roots, chords, arpeggios or anything else you want to explain.\n\nOn a computer keyboard, the left and right arrows change colour."
        },
        {
            target: "#toggle-note-names",
            title: "Show note names",
            text: "Switch note names on or off, and choose between Painted Notes, Interval Numbers or Full Keyboard.\n\nIntervals are calculated from your selected key or root. Option-click a painted note to explore alternative spellings."
        },
        {
            target: "#toggle-roots",
            title: "Highlight root notes",
            text: "Turn on Show Roots to highlight root notes without changing their painted colours.\n\nChoose any of the 12 chromatic roots independently, or select a key on the wheel to use its major or relative minor root."
        },
        {
            target: "#clear-piano",
            title: "Start fresh",
            text: "Clear Piano removes the painted and automatic notes so you can begin a new musical idea."
        },
        {
            target: "#history-controls",
            title: "Undo and Redo",
            text: "Undo or redo changes to your painted notes, including colour changes and alternative note or interval spellings.\n\nYou can even restore your painting after clearing the piano! Key and scale selections are controlled separately."
        },
        {
            target: "#sound-controls",
            title: "Hear the notes",
            text: "Use the Sound button to switch audio on or off, and adjust the slider to change the volume.\n\nOn a computer keyboard, the up and down arrows adjust volume."
        },
        {
            target: "#appearance-panel",
            title: "Make it yours",
            text: "Choose background and piano colours, or use the custom colour pickers.\n\nYour browser remembers your theme when storage is available. Reset restores the original colours."
        }
    ];

    const helpButton = document.getElementById("help-btn");
    const helpTour = document.getElementById("help-tour");
    if (typeof helpTour.showModal !== "function") {
        helpTour.classList.add("legacy-help");
    }
    const helpHighlight = document.getElementById("help-highlight");
    const helpBubble = document.getElementById("help-bubble");
    const helpTitle = document.getElementById("help-title");
    const helpText = document.getElementById("help-text");
    const helpProgress = document.getElementById("help-progress");
    const helpBack = document.getElementById("help-back");
    const helpNext = document.getElementById("help-next");
    const helpClose = document.getElementById("help-close");

    let helpStepIndex = 0;
    let helpPositionFrame = null;

    function isHelpOpen() {
        return helpTour.hasAttribute("open");
    }

    function openHelpTour() {
        if (typeof helpTour.showModal === "function") {
            helpTour.showModal();
        } else {
            helpTour.setAttribute("open", "");
        }
    }

    function closeHelpTour() {
        if (typeof helpTour.close === "function") {
            helpTour.close();
        } else {
            helpTour.removeAttribute("open");
            helpTour.dispatchEvent(new Event("close"));
        }
    }

    function positionHelpTour() {
        if (!isHelpOpen()) return;

        const target = document.querySelector(
            helpSteps[helpStepIndex].target
        );

        if (!target) return;

        let rect = target.getBoundingClientRect();

        if (helpSteps[helpStepIndex].target === "#sound-controls") {
            const soundRect =
                document.getElementById("sound-btn").getBoundingClientRect();

            const volumeRect =
                document.getElementById("volume-slider").getBoundingClientRect();

            rect = {
                left: Math.min(soundRect.left, volumeRect.left),
                top: Math.min(soundRect.top, volumeRect.top),
                right: Math.max(soundRect.right, volumeRect.right),
                bottom: Math.max(soundRect.bottom, volumeRect.bottom)
            };
        }

        const width = helpTour.clientWidth;
        const height = helpTour.clientHeight;
        const margin = 16;
        const gap = 12;
        const padding = 6;

        const clamp = (value, min, max) =>
            Math.max(min, Math.min(value, max));


        const left = clamp(rect.left - padding, 0, width);
        const top = clamp(rect.top - padding, 0, height);
        const right = clamp(rect.right + padding, left, width);
        const bottom = clamp(rect.bottom + padding, top, height);

        Object.assign(helpHighlight.style, {
            left: `${left}px`,
            top: `${top}px`,
            width: `${right - left}px`,
            height: `${bottom - top}px`
        });

        const shades = {
            top: document.getElementById("help-shade-top"),
            right: document.getElementById("help-shade-right"),
            bottom: document.getElementById("help-shade-bottom"),
            left: document.getElementById("help-shade-left")
        };

        function setShade(element, x, y, w, h) {
            element.style.left = x + "px";
            element.style.top = y + "px";
            element.style.width = Math.max(0, w) + "px";
            element.style.height = Math.max(0, h) + "px";
        }

        setShade(shades.top, 0, 0, width, top);
        setShade(shades.bottom, 0, bottom, width, height - bottom);
        setShade(shades.left, 0, top, left, bottom - top);
        setShade(shades.right, right, top, width - right, bottom - top);

        const bubbleWidth = helpBubble.offsetWidth;
        const bubbleHeight = helpBubble.offsetHeight;

        let bubbleLeft = (left + right - bubbleWidth) / 2;
        let bubbleTop;


        if (bottom + gap + bubbleHeight <= height - margin) {
            bubbleTop = bottom + gap;
        } else if (top - gap - bubbleHeight >= margin) {
            bubbleTop = top - gap - bubbleHeight;
        } else if (right + gap + bubbleWidth <= width - margin) {
            bubbleLeft = right + gap;
            bubbleTop = (top + bottom - bubbleHeight) / 2;
        } else if (left - gap - bubbleWidth >= margin) {
            bubbleLeft = left - gap - bubbleWidth;
            bubbleTop = (top + bottom - bubbleHeight) / 2;
        } else {

            bubbleTop = height - margin - bubbleHeight;
        }

        helpBubble.style.left = `${clamp(
            bubbleLeft, margin, width - bubbleWidth - margin
        )}px`;

        helpBubble.style.top = `${clamp(
            bubbleTop, margin, height - bubbleHeight - margin
        )}px`;
    }

    function scheduleHelpPosition() {
        if (!isHelpOpen() || helpPositionFrame !== null) return;

        helpPositionFrame = requestAnimationFrame(() => {
            helpPositionFrame = null;
            positionHelpTour();
        });
    }

    function showHelpStep(index) {
        helpStepIndex = Math.max(
            0, Math.min(index, helpSteps.length - 1)
        );

        const step = helpSteps[helpStepIndex];

        helpTitle.textContent = step.title;
        helpText.textContent = step.text;
        helpProgress.textContent =
            `${helpStepIndex + 1} of ${helpSteps.length}`;

        helpBack.disabled = helpStepIndex === 0;
        helpNext.textContent =
            helpStepIndex === helpSteps.length - 1
                ? "Finish"
                : "Next";

        helpBubble.scrollTop = 0;

        const helpTarget = document.querySelector(step.target);

        if (helpTarget) {
            helpTarget.scrollIntoView({
                behavior: "auto",
                block: "center",
                inline: "nearest"
            });
        }

        positionHelpTour();
        scheduleHelpPosition();


        if (helpBack.disabled &&
            document.activeElement === helpBack) {
            helpNext.focus({ preventScroll: true });
        }
    }

    helpButton.addEventListener("click", () => {
        if (isHelpOpen()) return;

        openHelpTour();
        showHelpStep(0);
        helpNext.focus({ preventScroll: true });
    });

    helpBack.addEventListener("click", () => {
        showHelpStep(helpStepIndex - 1);
    });

    helpNext.addEventListener("click", () => {
        if (helpStepIndex === helpSteps.length - 1) {
            closeHelpTour();
        } else {
            showHelpStep(helpStepIndex + 1);
        }
    });

    helpClose.addEventListener("click", () => {
        closeHelpTour();
    });

    helpTour.addEventListener("close", () => {
        cancelAnimationFrame(helpPositionFrame);
        helpPositionFrame = null;
        helpButton.focus({ preventScroll: true });
    });


    document.addEventListener("keydown", (event) => {
        if (!isHelpOpen()) return;

        event.stopImmediatePropagation();

        if (event.key === "Escape") {
            event.preventDefault();
            closeHelpTour();
        }

        if (event.key === "ArrowRight") {
            event.preventDefault();
            helpNext.click();
        }

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            helpBack.click();
        }
    }, true);

    window.addEventListener("resize", scheduleHelpPosition);
    window.addEventListener("scroll", scheduleHelpPosition, true);


    if (typeof ResizeObserver !== "undefined") {
        const helpResizeObserver = new ResizeObserver(
            scheduleHelpPosition
        );

        helpResizeObserver.observe(helpBubble);
    }


    // ABOUT NOTEPAINT

    const aboutBtn = document.getElementById("about-btn");
    const aboutOverlay = document.getElementById("about-overlay");
    const aboutClose = document.getElementById("about-close");

    function openAbout() {
        aboutOverlay.hidden = false;
        aboutClose.focus();
    }

    function closeAbout() {
        aboutOverlay.hidden = true;
        aboutBtn.focus();
    }

    aboutBtn.addEventListener("click", openAbout);

    aboutClose.addEventListener("click", closeAbout);

    aboutOverlay.addEventListener("click", function (event) {
        if (event.target === aboutOverlay) {
            closeAbout();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !aboutOverlay.hidden) {
            closeAbout();
        }
    });


    /* ===== NOTEPAINT NAVIGATION ===== */

    (function () {
        var menuButton = document.getElementById("menu-btn");
        var navigationMenu = document.getElementById("navigation-menu");

        if (!menuButton || !navigationMenu) return;

        function closeNavigation() {
            navigationMenu.hidden = true;
            menuButton.setAttribute("aria-expanded", "false");
            menuButton.setAttribute("aria-label", "Open navigation");
        }

        var metronomeMenuButton =
            document.getElementById("metronome-menu-btn");

        if (metronomeMenuButton) {
            metronomeMenuButton.addEventListener("click", closeNavigation);
        }

        menuButton.addEventListener("click", function (event) {
            event.stopPropagation();

            var isOpening = navigationMenu.hidden;

            navigationMenu.hidden = !isOpening;
            menuButton.setAttribute("aria-expanded", String(isOpening));
            menuButton.setAttribute(
                "aria-label",
                isOpening ? "Close navigation" : "Open navigation"
            );
        });

        document.addEventListener("click", function (event) {
            if (!navigationMenu.contains(event.target) &&
                !menuButton.contains(event.target)) {
                closeNavigation();
            }
        });


        document.addEventListener("touchstart", function (event) {
            if (!navigationMenu.contains(event.target) &&
                !menuButton.contains(event.target)) {
                closeNavigation();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !navigationMenu.hidden) {
                closeNavigation();
                menuButton.focus();
            }
        });
    })();



    /* ===== FLOATING METRONOME ===== */

    (function () {
        var metronomeButton = document.getElementById("metronome-menu-btn");
        var metronomePanel = document.getElementById("metronome-panel");
        var metronomeClose = document.getElementById("metronome-close");

        if (!metronomeButton || !metronomePanel || !metronomeClose) return;

        metronomeButton.addEventListener("click", function () {
            metronomePanel.hidden = false;
            metronomeButton.setAttribute("aria-expanded", "true");
        });

        metronomeClose.addEventListener("click", function () {
            metronomePanel.hidden = true;
            metronomeButton.setAttribute("aria-expanded", "false");
        });



        /* ===== METRONOME TEMPO ===== */

        var tempoDisplay = document.getElementById("metronome-bpm");
        var tempoSlider = document.getElementById("metronome-tempo-slider");
        var tempoMinus = document.getElementById("metronome-minus");
        var tempoPlus = document.getElementById("metronome-plus");

        var minTempo = Number(tempoSlider.min);
        var maxTempo = Number(tempoSlider.max);
        var tempo = Number(tempoSlider.value);

        function setTempo(newTempo) {

            tempo = Math.max(minTempo, Math.min(maxTempo, newTempo));


            tempoDisplay.textContent = tempo;
            tempoSlider.value = tempo;
        }


        tempoMinus.addEventListener("click", function () {
            setTempo(tempo - 1);
        });


        tempoPlus.addEventListener("click", function () {
            setTempo(tempo + 1);
        });


        tempoSlider.addEventListener("input", function () {
            setTempo(Number(tempoSlider.value));
        });

        /* ===== TAP TEMPO ===== */

        var tapButton = document.getElementById("metronome-tap");
        var tapTimes = [];

        tapButton.addEventListener("click", function () {

            var now = performance.now();


            if (tapTimes.length > 0 &&
                now - tapTimes[tapTimes.length - 1] > 2000) {
                tapTimes = [];
            }


            if (tapTimes.length > 0 &&
                now - tapTimes[tapTimes.length - 1] < 180) {
                return;
            }

            tapTimes.push(now);


            if (tapTimes.length > 5) {
                tapTimes.shift();
            }


            if (tapTimes.length < 2) return;


            var elapsed = tapTimes[tapTimes.length - 1] - tapTimes[0];
            var averageInterval = elapsed / (tapTimes.length - 1);


            var tappedBpm = Math.round(60000 / averageInterval);

            setTempo(tappedBpm);

        });

        /* ===== METRONOME AUDIO ===== */

        var metronomeStart = document.getElementById("metronome-start");
        var metronomeAccent = document.getElementById("metronome-accent");

        var metronomeAudio = null;
        var metronomeOutput = null;
        var metronomeTimer = null;
        var metronomePlaying = false;

        var nextClickTime = 0;

        var beatIndex = 0;
        var scheduledBeats = [];
        var beatAnimation = null;
        var lastBeatTime = -1;

        var beatLights = document.querySelectorAll(".metronome-beat");


        /* ===== METRONOME TIME SIGNATURE ===== */

        var beatsPerBar = 4;
        var beatUnits = [2, 4, 8, 16];
        var beatUnitIndex = 1; // Start in 4/4

        var topNumber = document.getElementById("metronome-top-number");
        var bottomNumber = document.getElementById("metronome-bottom-number");

        var topDown = document.getElementById("metronome-top-down");
        var topUp = document.getElementById("metronome-top-up");
        var bottomDown = document.getElementById("metronome-bottom-down");
        var bottomUp = document.getElementById("metronome-bottom-up");

        function updateMetronomeSignature() {


            topNumber.textContent = beatsPerBar;
            bottomNumber.textContent = beatUnits[beatUnitIndex];


            var beatContainer = document.getElementById("metronome-beats");

            beatContainer.innerHTML = "";

            for (var i = 0; i < beatsPerBar; i++) {
                var light = document.createElement("span");
                light.className = "metronome-beat";
                beatContainer.appendChild(light);
            }


            beatLights = document.querySelectorAll(".metronome-beat");


            beatIndex = beatIndex % beatsPerBar;


            lastBeatTime = -1;


            topDown.disabled = beatsPerBar === 1;
            topUp.disabled = beatsPerBar === 16;

            bottomDown.disabled = beatUnitIndex === 0;
            bottomUp.disabled = beatUnitIndex === beatUnits.length - 1;
        }

        topDown.addEventListener("click", function () {
            if (beatsPerBar > 1) {
                beatsPerBar--;
                updateMetronomeSignature();
            }
        });

        topUp.addEventListener("click", function () {
            if (beatsPerBar < 16) {
                beatsPerBar++;
                updateMetronomeSignature();
            }
        });

        bottomDown.addEventListener("click", function () {
            if (beatUnitIndex > 0) {
                beatUnitIndex--;
                updateMetronomeSignature();
            }
        });

        bottomUp.addEventListener("click", function () {
            if (beatUnitIndex < beatUnits.length - 1) {
                beatUnitIndex++;
                updateMetronomeSignature();
            }
        });


        updateMetronomeSignature();


        var lookahead = 25;
        var scheduleAheadTime = 0.1;




        function playMetronomeClick(when, beat) {

            var oscillator = metronomeAudio.createOscillator();
            var gain = metronomeAudio.createGain();

            oscillator.type = "sine";

            var isCompound =
                beatUnits[beatUnitIndex] === 8 &&
                (beatsPerBar === 6 ||
                    beatsPerBar === 9 ||
                    beatsPerBar === 12);

            var isDownbeat =
                metronomeAccent.checked && beat === 0;

            var isGroupAccent =
                metronomeAccent.checked &&
                isCompound &&
                beat !== 0 &&
                beat % 3 === 0;

            if (isDownbeat || isGroupAccent) {
                oscillator.frequency.value = 1400;
            } else {
                oscillator.frequency.value = 1000;
            }



            var clickVolume = isDownbeat ? 0.25 :
                isGroupAccent ? 0.18 : 0.25;

            gain.gain.setValueAtTime(clickVolume, when);

            gain.gain.exponentialRampToValueAtTime(0.001, when + 0.04);

            oscillator.connect(gain);
            gain.connect(metronomeOutput);

            oscillator.start(when);
            oscillator.stop(when + 0.04);
        }



        /* ===== METRONOME BEAT LIGHTS ===== */

        function updateBeatLights() {

            if (!metronomePlaying) return;

            var now = metronomeAudio.currentTime;


            while (
                scheduledBeats.length > 0 &&
                scheduledBeats[0].time <= now
            ) {

                var beat = scheduledBeats.shift();

                lastBeatTime = beat.time;


                for (var i = 0; i < beatLights.length; i++) {
                    beatLights[i].classList.remove("active");
                }


                if (beatLights[beat.index]) {
                    beatLights[beat.index].classList.add("active");
                }
            }


            if (now - lastBeatTime > 0.12) {

                for (var j = 0; j < beatLights.length; j++) {
                    beatLights[j].classList.remove("active");
                }
            }

            beatAnimation = requestAnimationFrame(updateBeatLights);
        }




        function scheduleMetronomeClick() {

            if (!metronomePlaying) return;

            while (
                nextClickTime <
                metronomeAudio.currentTime + scheduleAheadTime
            ) {


                playMetronomeClick(nextClickTime, beatIndex);


                scheduledBeats.push({
                    time: nextClickTime,
                    index: beatIndex
                });


                beatIndex = (beatIndex + 1) % beatsPerBar;


                nextClickTime += (60 / tempo) * (4 / beatUnits[beatUnitIndex]);

            }

            metronomeTimer = setTimeout(
                scheduleMetronomeClick,
                lookahead
            );
        }




        function stopMetronome() {

            metronomePlaying = false;

            clearTimeout(metronomeTimer);
            metronomeTimer = null;


            cancelAnimationFrame(beatAnimation);
            beatAnimation = null;

            scheduledBeats = [];
            lastBeatTime = -1;


            for (var i = 0; i < beatLights.length; i++) {
                beatLights[i].classList.remove("active");
            }



            if (metronomeOutput) {
                metronomeOutput.disconnect();
                metronomeOutput = null;
            }

            metronomeStart.textContent = "Start";
        }




        metronomeStart.addEventListener("click", function () {

            if (metronomePlaying) {
                stopMetronome();
                return;
            }

            if (!metronomeAudio) {

                var AudioContextClass =
                    window.AudioContext || window.webkitAudioContext;

                if (!AudioContextClass) return;

                metronomeAudio = new AudioContextClass();
            }

            metronomeAudio.resume();


            metronomeOutput = metronomeAudio.createGain();
            metronomeOutput.connect(metronomeAudio.destination);

            metronomePlaying = true;
            metronomeStart.textContent = "Stop";


            nextClickTime = metronomeAudio.currentTime + 0.05;


            beatIndex = 0;
            scheduledBeats = [];
            lastBeatTime = -1;


            scheduleMetronomeClick();


            updateBeatLights();

        });



        /* ===== DIRECT BPM ENTRY ===== */

        var bpmInput = document.getElementById("metronome-bpm-input");

        function beginBpmEdit() {
            bpmInput.value = tempo;

            tempoDisplay.hidden = true;
            bpmInput.hidden = false;

            bpmInput.focus();
            bpmInput.select();
        }

        function finishBpmEdit(save) {
            if (bpmInput.hidden) return;

            if (save && bpmInput.value.trim() !== "") {
                var enteredTempo = Number(bpmInput.value);

                if (isFinite(enteredTempo)) {
                    setTempo(Math.round(enteredTempo));
                }
            }

            bpmInput.hidden = true;
            tempoDisplay.hidden = false;
        }


        tempoDisplay.addEventListener("dblclick", beginBpmEdit);


        tempoDisplay.addEventListener("touchend", function (event) {
            if (event.changedTouches.length !== 1) return;

            event.preventDefault();
            beginBpmEdit();
        }, { passive: false });


        bpmInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                finishBpmEdit(true);
            } else if (event.key === "Escape") {
                finishBpmEdit(false);
            }
        });


        bpmInput.addEventListener("blur", function () {
            finishBpmEdit(true);
        });



        /* ===== DRAGGING ===== */

        var metronomeHeader = document.getElementById("metronome-header");

        var isDragging = false;
        var offsetX = 0;
        var offsetY = 0;

        metronomeHeader.addEventListener("mousedown", function (event) {


            if (metronomeClose.contains(event.target)) return;

            isDragging = true;

            var rect = metronomePanel.getBoundingClientRect();


            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;


            metronomePanel.style.left = rect.left + "px";
            metronomePanel.style.top = rect.top + "px";
            metronomePanel.style.right = "auto";

            event.preventDefault();
        });

        document.addEventListener("mousemove", function (event) {

            if (!isDragging) return;

            var newX = event.clientX - offsetX;
            var newY = event.clientY - offsetY;


            newX = Math.max(0, Math.min(newX,
                window.innerWidth - metronomePanel.offsetWidth));

            newY = Math.max(0, Math.min(newY,
                window.innerHeight - metronomePanel.offsetHeight));

            metronomePanel.style.left = newX + "px";
            metronomePanel.style.top = newY + "px";
        });

        document.addEventListener("mouseup", function () {
            isDragging = false;
        });


        /* ===== TOUCH DRAGGING (iPad) ===== */

        metronomeHeader.addEventListener("touchstart", function (event) {

            if (metronomeClose.contains(event.target)) return;
            if (event.touches.length !== 1) return;

            var touch = event.touches[0];
            var rect = metronomePanel.getBoundingClientRect();

            isDragging = true;

            offsetX = touch.clientX - rect.left;
            offsetY = touch.clientY - rect.top;

            metronomePanel.style.left = rect.left + "px";
            metronomePanel.style.top = rect.top + "px";
            metronomePanel.style.right = "auto";

            event.preventDefault();

        }, { passive: false });


        document.addEventListener("touchmove", function (event) {

            if (!isDragging) return;
            if (event.touches.length !== 1) return;

            var touch = event.touches[0];

            var newX = touch.clientX - offsetX;
            var newY = touch.clientY - offsetY;

            newX = Math.max(0, Math.min(newX,
                window.innerWidth - metronomePanel.offsetWidth));

            newY = Math.max(0, Math.min(newY,
                window.innerHeight - metronomePanel.offsetHeight));

            metronomePanel.style.left = newX + "px";
            metronomePanel.style.top = newY + "px";

            event.preventDefault();

        }, { passive: false });


        document.addEventListener("touchend", function () {
            isDragging = false;
        });

        document.addEventListener("touchcancel", function () {
            isDragging = false;
        });


    })();


})();