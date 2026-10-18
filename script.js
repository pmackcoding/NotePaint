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
        flex.remove();

        return supported;
    })();

    if (!flexGapSupported) {
        document.documentElement.classList.add("no-flex-gap");
    }


    //FRETBOARD

    const strings = 6;
    const frets = 25;

    // HANDEDNESS TOGGLE

    const handednessBtn = document.getElementById("handedness-btn");
    const fretboardStage = document.getElementById("fretboard-stage");


    try {
        if (localStorage.getItem("notepaint-handedness") === "left") {
            fretboardStage.classList.add("left-handed");
            handednessBtn.textContent = "Left-Handed";
            handednessBtn.setAttribute("aria-pressed", "true");
        }
    } catch (error) {
        console.warn("Could not restore handedness:", error);
    }

    handednessBtn.addEventListener("click", () => {
        const isLeftHanded = fretboardStage.classList.toggle("left-handed");

        handednessBtn.textContent = isLeftHanded
            ? "Left-Handed"
            : "Right-Handed";

        handednessBtn.setAttribute("aria-pressed", String(isLeftHanded));


        try {
            localStorage.setItem(
                "notepaint-handedness",
                isLeftHanded ? "left" : "right"
            );
        } catch (error) {
            console.warn("Could not save handedness:", error);
        }
    });

    const openNoteIndex = [4, 9, 2, 7, 11, 4];
    const NOTE_NAMES = [
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

    let currentWheelPosition = 0;




    // SOUND

    let isMuted = true;
    let volume = 0.15;

    const soundBtn = document.getElementById("sound-btn");
    const volumeSlider = document.getElementById("volume-slider");


    const guitarSounds = [
        "Sound Files/Low E.wav",
        "Sound Files/A.wav",
        "Sound Files/D.wav",
        "Sound Files/G.wav",
        "Sound Files/B.wav",
        "Sound Files/High E.wav"
    ];

    // WEB AUDIO SETUP

    const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

    let guitarAudioContext = null;
    let guitarAudioBuffers = null;
    let guitarAudioLoading = null;

    function loadGuitarAudio() {
        if (guitarAudioLoading) return guitarAudioLoading;

        if (!AudioContextClass) {
            return Promise.reject(
                new Error("Web Audio is not supported")
            );
        }

        if (!guitarAudioContext) {
            guitarAudioContext = new AudioContextClass();
        }

        guitarAudioLoading = Promise.all(
            guitarSounds.map(path =>
                fetch(path)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error("Could not load " + path);
                        }

                        return response.arrayBuffer();
                    })
                    .then(arrayBuffer =>
                        new Promise((resolve, reject) => {
                            guitarAudioContext.decodeAudioData(
                                arrayBuffer,
                                resolve,
                                reject
                            );
                        })
                    )
            )
        ).then(buffers => {
            guitarAudioBuffers = buffers;
            return buffers;
        }).catch(error => {
            guitarAudioLoading = null;
            throw error;
        });

        return guitarAudioLoading;
    }



    soundBtn.addEventListener("click", () => {
        isMuted = !isMuted;
        updateSoundButton();

        if (!isMuted) {
            loadGuitarAudio()
                .then(() => guitarAudioContext.resume())
                .catch(error => {
                    console.error("Could not prepare guitar audio:", error);
                });
        }
    });

    volumeSlider.value = volume;

    volumeSlider.addEventListener("input", () => {
        volume = parseFloat(volumeSlider.value);
        isMuted = volume === Number(volumeSlider.min);
        updateSoundButton();
    });

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


    const activeStringNotes = Array(strings).fill(null);

    const noteHoldSeconds = 1.6;
    const noteReleaseSeconds = 1.45;

    function releaseGuitarNote(voice, seconds = noteReleaseSeconds) {
        if (voice.releasing) return;

        voice.releasing = true;

        const context = guitarAudioContext;
        const now = context.currentTime;

        clearTimeout(voice.holdTimer);

        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.volume, now);

        voice.gain.gain.setTargetAtTime(
            0,
            now,
            seconds / 5
        );

        voice.source.stop(now + seconds + 0.01);
    }

    function playGuitarString(stringIndex, fret) {
        if (isMuted) return;

        if (!guitarAudioBuffers || !guitarAudioContext) return;

        const context = guitarAudioContext;

        if (context.state !== "running") {
            context.resume().catch(console.error);
        }

        const previousVoice = activeStringNotes[stringIndex];

        if (previousVoice) {
            releaseGuitarNote(previousVoice, 0.55);
        }

        const source = context.createBufferSource();
        const gain = context.createGain();

        source.buffer = guitarAudioBuffers[stringIndex];
        source.playbackRate.value = Math.pow(2, fret / 12);

        gain.gain.value = volume;

        source.connect(gain);
        gain.connect(context.destination);

        const voice = {
            source,
            gain,
            volume,
            stringIndex,
            holdTimer: null,
            releasing: false
        };

        activeStringNotes[stringIndex] = voice;

        source.onended = () => {
            clearTimeout(voice.holdTimer);

            if (activeStringNotes[stringIndex] === voice) {
                activeStringNotes[stringIndex] = null;
            }

            source.disconnect();
            gain.disconnect();
        };

        source.start();

        voice.holdTimer = setTimeout(() => {
            releaseGuitarNote(voice);
        }, noteHoldSeconds * 1000);
    }


    // UNDO / REDO HISTORY

    const undoStack = [];
    const redoStack = [];
    const historyLimit = 50;

    function capturePaintedNotes() {
        return Array.from(fretboard.querySelectorAll(".fret"), cell => {
            const dot = cell.querySelector(".dot:not(.preset)");

            if (!dot) return null;

            return {
                className: dot.className,
                noteName: dot.dataset.noteName,
                enharmonicOverride: dot.dataset.enharmonicOverride || null
            };
        });
    }

    function saveUndoState() {
        undoStack.push(capturePaintedNotes());

        if (undoStack.length > historyLimit) {
            undoStack.shift();
        }

        redoStack.length = 0;
        updateHistoryButtons();
    }


    function restorePaintedNotes(snapshot) {
        const cells = fretboard.querySelectorAll(".fret");

        cells.forEach((cell, index) => {
            const savedNote = snapshot[index];
            const existingDot = cell.querySelector(".dot");



            if (existingDot) {
                existingDot.remove();
            }

            if (!savedNote) return;

            const dot = document.createElement("div");

            dot.className = savedNote.className;
            dot.dataset.noteName = savedNote.noteName;

            if (savedNote.enharmonicOverride) {
                dot.dataset.enharmonicOverride =
                    savedNote.enharmonicOverride;
            }

            cell.appendChild(dot);
        });


        clearPresetNotes();

        if (selectedRoot !== null) {
            fillScale(selectedRoot, currentScale);
        }

        applyStringFilter();
        refreshRootHighlights();
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

    // UNDO / REDO BUTTONS

    const undoButton = document.getElementById("undo");
    const redoButton = document.getElementById("redo");

    function updateHistoryButtons() {
        undoButton.disabled = undoStack.length === 0;
        redoButton.disabled = redoStack.length === 0;
    }

    undoButton.addEventListener("click", undoPainting);
    redoButton.addEventListener("click", redoPainting);

    // UNDO / REDO KEYBOARD SHORTCUTS

    document.addEventListener("keydown", (event) => {
        if (!(event.metaKey || event.ctrlKey)) return;
        if (event.altKey) return;

        if (event.target.matches("input, textarea, select") ||
            event.target.isContentEditable) {
            return;
        }

        if (event.key.toLowerCase() !== "z") return;

        event.preventDefault();

        if (event.shiftKey) {
            redoPainting();
        } else {
            undoPainting();
        }
    });

    //ADD DOTS + CLICK LOGIC

    const ENHARMONIC_NAMES = {
        1: ["C♯", "D♭"],
        3: ["D♯", "E♭"],
        6: ["F♯", "G♭"],
        8: ["G♯", "A♭"],
        10: ["A♯", "B♭"]
    };

    function toggleEnharmonicName(cell) {
        const dot = cell.querySelector(".dot");

        if (!dot || dot.classList.contains("position-hidden")) return;

        const noteIndex = Number(cell.dataset.noteIndex);
        const alternatives = ENHARMONIC_NAMES[noteIndex];

        if (!alternatives) return;

        if (dot.dataset.enharmonicOverride) {
            delete dot.dataset.enharmonicOverride;
            dot.dataset.noteName = cell.dataset.noteName;
        } else {
            const currentName = dot.dataset.noteName;

            dot.dataset.enharmonicOverride =
                currentName === alternatives[0]
                    ? alternatives[1]
                    : alternatives[0];

            dot.dataset.noteName = dot.dataset.enharmonicOverride;
        }
    }

    // LONG-PRESS ENHARMONIC SWITCHING

    let longPressTimer = null;
    let longPressTriggered = false;
    let longPressStartX = 0;
    let longPressStartY = 0;

    function cancelLongPress() {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }

    function startLongPress(event, cell) {
        if (event.touches.length !== 1) return;

        const dot = cell.querySelector(".dot");

        if (!dot || dot.classList.contains("position-hidden")) return;

        longPressTriggered = false;

        longPressStartX = event.touches[0].clientX;
        longPressStartY = event.touches[0].clientY;

        cancelLongPress();

        longPressTimer = setTimeout(() => {
            toggleEnharmonicName(cell);
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

        const distanceX =
            Math.abs(event.touches[0].clientX - longPressStartX);

        const distanceY =
            Math.abs(event.touches[0].clientY - longPressStartY);

        if (distanceX > 10 || distanceY > 10) {
            cancelLongPress();
        }
    }

    function addDotToCell(cell, color = "yellow", preset = false) {
        const existing = cell.querySelector(".dot");
        if (existing) return;

        const dot = document.createElement("div");
        dot.classList.add("dot", color);
        dot.dataset.noteName = cell.dataset.noteName;

        if (preset) dot.classList.add("preset");

        cell.appendChild(dot);
    }

    const fretboard = document.getElementById("fretboard");

    for (let string = 0; string < strings; string++) {
        const stringRow = document.createElement("div");
        stringRow.className = "string";

        for (let fret = 0; fret < frets; fret++) {
            const fretDiv = document.createElement("div");
            fretDiv.className = "fret";

            const realString = strings - 1 - string;
            const noteIndex = (openNoteIndex[realString] + fret) % 12;

            fretDiv.dataset.noteIndex = noteIndex;
            fretDiv.dataset.noteName = NOTE_NAMES[noteIndex];


            fretDiv.addEventListener("touchstart", (event) => {
                startLongPress(event, fretDiv);
            }, { passive: true });

            fretDiv.addEventListener("touchmove", moveLongPress, {
                passive: true
            });

            fretDiv.addEventListener("touchend", cancelLongPress);
            fretDiv.addEventListener("touchcancel", cancelLongPress);


            fretDiv.addEventListener("click", (event) => {

                if (longPressTriggered) {
                    longPressTriggered = false;
                    event.preventDefault();
                    return;
                }

                if (event.altKey) {
                    event.preventDefault();
                    toggleEnharmonicName(fretDiv);
                    return;
                }

                let dot = fretDiv.querySelector(".dot");
                let noteAdded = false;

                saveUndoState();

                if (dot && dot.classList.contains("position-hidden")) {
                    dot.remove();
                    dot = null;
                }

                if (!dot) {

                    addDotToCell(fretDiv, currentColor);

                    noteAdded = true;
                }
                else if (dot.classList.contains(currentColor)) {

                    dot.remove();
                }
                else {

                    dot.className = "dot " + currentColor;

                    noteAdded = true;
                }


                if (noteAdded && !isMuted) {
                    const reversedStringIndex = strings - 1 - string;

                    playGuitarString(reversedStringIndex, fret);
                }
            });

            stringRow.appendChild(fretDiv);
        }

        fretboard.appendChild(stringRow);
    }



    const inlayFrets = [3, 5, 7, 9, 12, 15, 17, 19, 21];
    const inlays = document.getElementById("inlays");

    for (let row = 0; row < strings; row++) {
        for (let fret = 0; fret < frets; fret++) {
            const cell = document.createElement("div");

            if (inlayFrets.includes(fret) && fret !== 12 && row === 2) {
                const dot = document.createElement("div");
                dot.className = "inlay";
                cell.appendChild(dot);
            }

            if (fret === 12 && (row === 1 || row === 3)) {
                const dot = document.createElement("div");
                dot.className = "inlay";
                cell.appendChild(dot);
            }

            if (fret === 24 && (row === 1 || row === 3)) {
                const dot = document.createElement("div");
                dot.className = "inlay";
                cell.appendChild(dot);
            }

            inlays.appendChild(cell);
        }
    }


    const paletteColors = document.querySelectorAll(".palette-color");

    let paletteIndex = 0;
    let currentColor = "yellow";
    function setPaletteByIndex(index, doFlash = true) {


        paletteIndex = (index + paletteColors.length) % paletteColors.length;

        paletteColors.forEach(c => {
            c.classList.remove("active");
            c.setAttribute("aria-pressed", "false");
        });


        const selected = paletteColors[paletteIndex];
        currentColor = selected.dataset.color;
        selected.classList.add("active");
        selected.setAttribute("aria-pressed", "true");

        if (doFlash) {
            flashPalette(selected);
        }
    }

    paletteColors.forEach((color, index) => {
        color.addEventListener("click", () => {
            setPaletteByIndex(index);
        });
    });


    setPaletteByIndex(2, false);


    function flashPalette(el) {
        el.classList.remove("flash");
        void el.offsetWidth;
        el.classList.add("flash");
    }


    document.addEventListener("keydown", (e) => {

        if (e.target.matches("input, textarea, select") ||
            e.target.isContentEditable) {
            return;
        }

        if (e.key === "ArrowRight") {
            e.preventDefault();
            setPaletteByIndex(paletteIndex + 1);
        }

        if (e.key === "ArrowLeft") {
            e.preventDefault();
            setPaletteByIndex(paletteIndex - 1);
        }

        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();

            const step = Number(volumeSlider.step);
            const min = Number(volumeSlider.min);
            const max = Number(volumeSlider.max);
            const direction = e.key === "ArrowUp" ? 1 : -1;

            volume = Math.max(
                min,
                Math.min(max, Number((volume + direction * step).toFixed(2)))
            );

            volumeSlider.value = volume;


            isMuted = e.key === "ArrowUp" ? false : volume === min;

            updateSoundButton();
            updateVolumeFill();
        }
    });

    // SCALE AND KEY LOGIC


    const scaleOptions = document.querySelectorAll(".scale-option");

    const keySegments = document.querySelectorAll(".key-segment");

    let selectedRoot = null;


    const DIATONIC = [0, 2, 4, 5, 7, 9, 11];
    const PENTATONIC = [0, 2, 4, 7, 9];


    let currentScale = DIATONIC;

    function getNoteName(noteIndex) {
        if (selectedRoot !== null) {
            const interval = (noteIndex - selectedRoot + 12) % 12;
            const degree = DIATONIC.indexOf(interval);

            if (degree !== -1) {
                return MAJOR_KEY_NAMES[selectedRoot][degree];
            }
        }


        return NOTE_NAMES[noteIndex];
    }

    function refreshNoteNames() {
        fretboard.querySelectorAll(".fret").forEach(cell => {
            const noteIndex = Number(cell.dataset.noteIndex);
            const name = getNoteName(noteIndex);

            cell.dataset.noteName = name;

            const dot = cell.querySelector(".dot");
            if (dot) {
                dot.dataset.noteName =
                    dot.dataset.enharmonicOverride || name;
            }
        });
    }


    function clearPresetNotes() {
        document.querySelectorAll(".dot.preset").forEach(dot => {
            dot.remove();
        });
    }


    function fillScale(rootNote, intervals) {
        const rows = document.querySelectorAll(".string");

        rows.forEach((rowEl, visualStringIndex) => {
            const realString = strings - 1 - visualStringIndex;
            const openNote = openNoteIndex[realString];

            const cells = rowEl.querySelectorAll(".fret");

            cells.forEach((cell, fretIndex) => {
                const note = (openNote + fretIndex) % 12;


                const interval = (note - rootNote + 12) % 12;

                if (intervals.includes(interval)) {
                    addDotToCell(cell, "yellow", true);
                }
            });
        });

        applyPositionFilter();
    }





    // CIRCLE OF FIFTHS KEY SELECTION
    keySegments.forEach(segment => {
        segment.addEventListener("click", () => {

            const clickedRoot = Number(segment.dataset.root);
            const wheel = document.querySelector('.key-wheel');


            if (selectedRoot === clickedRoot) {
                selectedRoot = null;
                refreshNoteNames();
                segment.classList.remove("selected");
                clearPresetNotes();



                return;
            }

            selectedRoot = clickedRoot;
            refreshNoteNames();

            keySegments.forEach(key => {
                key.classList.remove("selected");
            });

            segment.classList.add("selected");


            if (wheel) {

                const targetIndex = Number(getComputedStyle(segment).getPropertyValue('--i').trim()) || 0;


                const currentWrapped = ((currentWheelPosition % 12) + 12) % 12;


                let diff = targetIndex - currentWrapped;
                if (diff > 6) diff -= 12;
                if (diff < -6) diff += 12;


                currentWheelPosition += diff;

                wheel.style.setProperty('--wheel-rotation', currentWheelPosition);
            }




            clearPresetNotes();

            fillScale(selectedRoot, currentScale);

            applyStringFilter();

        });
    });


    // SCALE TYPE SELECTOR
    scaleOptions.forEach(button => {
        button.addEventListener("click", () => {


            scaleOptions.forEach(option => {
                option.classList.remove("selected");
            });

            button.classList.add("selected");


            if (button.dataset.scale === "pentatonic") {
                currentScale = PENTATONIC;
            } else {
                currentScale = DIATONIC;
            }


            updatePositionOptions();
            clearPresetNotes();

            if (selectedRoot !== null) {
                fillScale(selectedRoot, currentScale);
            }

            applyStringFilter();
            
        });
    });

    // CLEAR FRETBOARD BUTTON

    document.getElementById("clear").addEventListener("click", () => {

        if (document.querySelector(".dot:not(.preset)")) {
            saveUndoState();
        }

        document.querySelectorAll(".dot").forEach(dot => dot.remove());


        selectedRoot = null;
        refreshNoteNames();

        keySegments.forEach(key => {
            key.classList.remove("selected");
        });

        positionSelect.value = "full";

        visibleStrings.fill(true);
        updateStringFilterButtons();
        applyStringFilter();
    });

    // APPEARANCE CUSTOMISATION //


    const originalPageColor = "#edd69d";
    const originalBoardColor = "#5a3a1a";
    const originalPageBackground =
        "linear-gradient(to bottom, #edd69dd8, #d98e62e8)";

    const themeStorageKey = "guitar-fretboard-theme";

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
    const boardElement = document.getElementById("fretboard");


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

    console.log(
        "Restored background:",
        document.body.style.background,
        "Label colour:",
        document.body.style.getPropertyValue("--lower-label-color")
    );

    function updateVolumeFill() {
        const min = Number(volumeSlider.min);
        const max = Number(volumeSlider.max);
        const percentage =
            ((Number(volumeSlider.value) - min) / (max - min)) * 100;

        volumeSlider.style.setProperty("--volume-fill", `${percentage}%`);
    }

    volumeSlider.addEventListener("input", updateVolumeFill);
    updateVolumeFill();

    const noteNamesBtn = document.getElementById("note-names-btn");

    noteNamesBtn.addEventListener("click", () => {
        const namesVisible =
            fretboard.classList.toggle("show-note-names");

        noteNamesBtn.setAttribute("aria-pressed", String(namesVisible));
    });

    // SCALE POSITION PATTERNS


    const POSITION_PATTERNS = {
        pentatonic: [
            {
                name: "C / Am",
                frets: [
                    [0, 3], [1, 3], [0, 2],
                    [0, 2], [0, 3], [0, 3]
                ]
            },
            {
                name: "A / Gm",
                frets: [
                    [3, 5], [3, 5], [2, 5],
                    [2, 5], [3, 5], [3, 5]
                ]
            },
            {
                name: "G / Em",
                frets: [
                    [5, 8], [5, 8], [5, 7],
                    [5, 7], [5, 7], [5, 8]
                ]
            },
            {
                name: "E / Dm",
                frets: [
                    [8, 10], [8, 10], [7, 9],
                    [7, 10], [7, 10], [8, 10]
                ]
            },
            {
                name: "D / Cm",
                frets: [
                    [10, 12], [10, 13], [9, 12],
                    [10, 12], [10, 12], [10, 12]
                ]
            }
        ],

        caged: [
            {
                name: "C / Am",
                frets: [
                    [0, 1, 3], [0, 1, 3], [0, 2],
                    [0, 2, 3], [0, 2, 3], [0, 1, 3]
                ]
            },
            {
                name: "A / Gm",
                frets: [
                    [1, 3, 5], [3, 5], [2, 4, 5],
                    [2, 3, 5], [2, 3, 5], [1, 3, 5]
                ]
            },
            {
                name: "A / Gm (Alt)",
                frets: [
                    [3, 5, 7], [5, 6], [4, 5, 7],
                    [3, 5, 7], [3, 5, 7], [3, 5, 7]
                ]
            },
            {
                name: "G / Em",
                frets: [
                    [5, 7, 8], [5, 6, 8], [4, 5, 7],
                    [5, 7], [5, 7, 8], [5, 7, 8]
                ]
            },
            {
                name: "E / Dm",
                frets: [
                    [7, 8, 10], [8, 10], [7, 9, 10],
                    [7, 9, 10], [7, 8, 10], [7, 8, 10]
                ]
            },
            {
                name: "E / Dm (Alt)",
                frets: [
                    [8, 10, 12], [10, 12], [9, 10, 12],
                    [9, 10, 12], [8, 10, 12], [8, 10, 12]
                ]
            },
            {
                name: "D / Cm",
                frets: [
                    [10, 12, 13], [10, 12, 13], [9, 10, 12],
                    [9, 10, 12], [10, 12], [10, 12, 13]
                ]
            }
        ],

        threeNPS: [
            {
                name: "Ionian",
                frets: [
                    [10, 12, 13], [10, 12, 13], [9, 10, 12],
                    [9, 10, 12], [8, 10, 12], [8, 10, 12]
                ]
            },
            {
                name: "Dorian",
                frets: [
                    [12, 13, 15], [12, 13, 15], [10, 12, 14],
                    [10, 12, 14], [10, 12, 14], [10, 12, 13]
                ]
            },
            {
                name: "Phrygian",
                frets: [
                    [1, 3, 5], [1, 3, 5], [0, 2, 4],
                    [0, 2, 3], [0, 2, 3], [0, 1, 3]
                ]
            },
            {
                name: "Lydian",
                frets: [
                    [3, 5, 7], [3, 5, 6], [2, 4, 5],
                    [2, 3, 5], [2, 3, 5], [1, 3, 5]
                ]
            },
            {
                name: "Mixolydian",
                frets: [
                    [5, 7, 8], [5, 6, 8], [4, 5, 7],
                    [3, 5, 7], [3, 5, 7], [3, 5, 7]
                ]
            },
            {
                name: "Aeolian",
                frets: [
                    [7, 8, 10], [6, 8, 10], [5, 7, 9],
                    [5, 7, 9], [5, 7, 8], [5, 7, 8]
                ]
            },
            {
                name: "Locrian",
                frets: [
                    [8, 10, 12], [8, 10, 12], [7, 9, 10],
                    [7, 9, 10], [7, 8, 10], [7, 8, 10]
                ]
            }
        ]
    };

    const positionSystem = document.getElementById("position-system");
    const positionSelect = document.getElementById("position-select");
    const positionSystemRow =
        document.getElementById("position-system-row");

    function getPositionPatterns() {
        if (currentScale === PENTATONIC) {
            return POSITION_PATTERNS.pentatonic;
        }

        return POSITION_PATTERNS[positionSystem.value];
    }

    function updatePositionOptions() {

        const previousName =
            positionSelect.selectedOptions[0]
                ? positionSelect.selectedOptions[0].textContent
                : null;

        const wasFull = positionSelect.value === "full";
        const isPentatonic = currentScale === PENTATONIC;

        positionSystemRow.hidden = isPentatonic;

        positionSelect.options.length = 0;
        positionSelect.add(new Option("Full Fretboard", "full"));

        const patterns = getPositionPatterns();

        patterns.forEach((pattern, index) => {
            positionSelect.add(
                new Option(pattern.name, String(index))
            );
        });

        if (wasFull || !previousName) return;


        const matchingName = previousName.replace(" (Alt)", "");

        const matchingIndex = patterns.findIndex(pattern =>
            pattern.name === matchingName
        );

        if (matchingIndex !== -1) {
            positionSelect.value = String(matchingIndex);
        }
    }

    function applyPositionFilter() {
        const showFull =
            positionSelect.value === "full" || selectedRoot === null;

        const pattern = showFull
            ? null
            : getPositionPatterns()[Number(positionSelect.value)];

        fretboard.querySelectorAll(".string").forEach((row, rowIndex) => {
            row.querySelectorAll(".fret").forEach((cell, fretIndex) => {
                const dot = cell.querySelector(".dot.preset");


                if (!dot) return;

                const belongsToShape = showFull ||
                    pattern.frets[rowIndex].some(referenceFret => {
                        const difference =
                            fretIndex - referenceFret - selectedRoot;


                        return difference % 12 === 0;
                    });

                dot.classList.toggle(
                    "position-hidden",
                    !belongsToShape
                );
            });
        });
    }

    positionSelect.addEventListener("change", applyPositionFilter);

    positionSystem.addEventListener("change", () => {
        updatePositionOptions();
        applyPositionFilter();
    });

    updatePositionOptions();

    // STRING FILTER

    const stringFilterButtons =
        document.querySelectorAll(".string-filter-btn");

    const visibleStrings = [true, true, true, true, true, true];

    function applyStringFilter() {
        fretboard.querySelectorAll(".string").forEach((row, index) => {
            row.querySelectorAll(".dot").forEach(dot => {
                dot.classList.toggle("string-hidden", !visibleStrings[index]);
            });
        });
    }

    function updateStringFilterButtons() {
        const allSelected = visibleStrings.every(Boolean);

        stringFilterButtons.forEach(button => {
            const stringIndex = button.dataset.string;

            const active = stringIndex === "all"
                ? allSelected
                : !allSelected && visibleStrings[Number(stringIndex)];

            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });
    }

    stringFilterButtons.forEach(button => {
        button.addEventListener("click", () => {
            const stringIndex = button.dataset.string;

            if (stringIndex === "all") {
                visibleStrings.fill(true);
            } else {
                const index = Number(stringIndex);
                const allSelected = visibleStrings.every(Boolean);

                if (allSelected) {
                    visibleStrings.fill(false);
                    visibleStrings[index] = true;
                } else {
                    visibleStrings[index] = !visibleStrings[index];
                }
            }

            updateStringFilterButtons();
            applyStringFilter();
        });
    });

    // HELP TOUR

    const helpSteps = [
        {
            target: "#fretboard-wrapper",
            title: "Paint the fretboard",
            text: "Click or tap a fret to add a note in your chosen colour. Tap with the same colour again to remove it, or choose another colour to recolour it.\n\nOn smaller screens, swipe the fretboard sideways to reach the higher frets."
        },
        {
            target: "#circle-of-fifths",
            title: "Choose a key",
            text: "Choose a major key or its relative minor to display the scale notes. Select the same key again to switch them off.\n\nWhen a shape is selected, changing the key moves that shape around the fretboard."
        },
        {
            target: "#scale-selector-container",
            title: "Choose your scale",
            text: "Switch between pentatonic and diatonic scales. Matching CAGED shapes stay selected, so you can see which notes appear or disappear."
        },
        {
            target: "#position-controls",
            title: "Explore the shapes",
            text: "Choose Full Fretboard or an individual shape.\n\nDiatonic scales offer CAGED and three-notes-per-string systems. Pentatonic scales use the five standard shapes. Manually painted notes remain visible - even when key is toggled on/off"
        },
        {
            target: "#string-filter",
            title: "Choose your strings",
            text: "Show notes on individual strings or any combination of strings.\n\nSelect All to display every string again. Your painted notes are preserved when strings are hidden."
        },
        {
            target: "#palette",
            title: "Choose a colour",
            text: "Choose the colour for your next painted note. Use different colours to mark roots, chords, arpeggios or anything else you want to explain.\n\nOn a keyboard, the left and right arrows change colour."
        },
        {
            target: "#note-names-btn",
            title: "Show note names",
            text: "Switch the note names on or off. Scale notes use the appropriate sharp or flat spelling for the selected key. If you need to change enharmonic spelling it's alt+click on computer, long press on tablet"
        },

        {
            target: "#show-roots-btn",
            title: "Highlight root notes",
            text: "Turn on Show Roots to add a ring around your chosen root notes without changing their painted colours.\n\nWith a key selected, choose its major or relative minor root. With no key selected, choose any of the twelve notes using the Root menu."
        },

        {
            target: "#clear",
            title: "Start fresh",
            text: "Clear Fretboard removes all painted and automatic notes, deselects the key and returns the Shape menu to Full Fretboard."
        },
        {
            target: "#history-controls",
            title: "Undo and Redo",
            text: "Use these arrows to undo or redo changes to your manually painted notes.\n\nYou can even clear the fretboard and bring your entire painting back with Undo!"
        },
        {
            target: "#handedness-btn",
            title: "Switch handedness",
            text: "Switch instantly between right-handed and left-handed fretboard views without changing your notes, scales or shapes.\n\nYour preference is remembered for next time."
        },
        {
            target: "#sound-controls",
            title: "Hear the notes",
            text: "Turn sound on to hear notes as you add or recolour them. Adjust the slider to change the volume.\n\nOn a keyboard, the up and down arrows adjust volume. Sound starts switched off."
        },
        {
            target: "#appearance-panel",
            title: "Make it yours",
            text: "Choose background and fretboard colours, or use the custom colour pickers.\n\nYour browser remembers your theme when storage is available. Reset restores the original colours."
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

    // ROOT HIGHLIGHTING

    const showRootsBtn = document.getElementById("show-roots-btn");
    const rootChoiceRow = document.getElementById("root-choice-row");
    const rootChoice = document.getElementById("root-choice");

    let rootsVisible = false;
    let keyRootChoice = "major";
    let manualRootNote = 0;

    const ROOT_NOTE_LABELS = [
        "C", "C♯ / D♭", "D", "D♯ / E♭", "E", "F",
        "F♯ / G♭", "G", "G♯ / A♭", "A", "A♯ / B♭", "B"
    ];


    function getRootChoices() {
        if (selectedRoot === null) {
            return ROOT_NOTE_LABELS.map((name, note) => ({
                value: String(note),
                name,
                note
            }));
        }

        const names = MAJOR_KEY_NAMES[selectedRoot];

        const choices = [
            {
                value: "major",
                name: `${names[0]} Major`,
                note: selectedRoot
            },
            {
                value: "minor",
                name: `${names[5]} Minor`,
                note: (selectedRoot + 9) % 12
            }
        ];

        const hasModalShape =
            currentScale === DIATONIC &&
            positionSystem.value === "threeNPS" &&
            positionSelect.value !== "full";

        if (hasModalShape) {
            const shapeIndex = Number(positionSelect.value);
            const interval = DIATONIC[shapeIndex];

            choices.push({
                value: "modal",
                name: "Modal Root",
                note: (selectedRoot + interval) % 12
            });
        }

        return choices;
    }

    function getHighlightedRoot() {
        const value = selectedRoot === null
            ? String(manualRootNote)
            : keyRootChoice;

        return getRootChoices().find(
            choice => choice.value === value
        ).note;
    }

    function refreshRootHighlights() {
        const rootNote = getHighlightedRoot();

        const isModalRoot =
            selectedRoot !== null &&
            keyRootChoice === "modal";

        fretboard.querySelectorAll(".dot").forEach(dot => {
            const note = Number(
                dot.parentElement.dataset.noteIndex
            );

            const shouldHighlight =
                rootsVisible &&
                note === rootNote &&
                !dot.classList.contains("position-hidden");

            dot.classList.toggle("root", shouldHighlight);

            dot.classList.toggle(
                "modal-root",
                shouldHighlight && isModalRoot
            );
        });
    }

    function updateRootChoices() {
        const choices = getRootChoices();

        if (selectedRoot !== null &&
            !choices.some(choice => choice.value === keyRootChoice)) {
            keyRootChoice = "major";
        }

        rootChoice.options.length = 0;

        choices.forEach(choice => {
            rootChoice.add(new Option(choice.name, choice.value));
        });

        rootChoice.value = selectedRoot === null
            ? String(manualRootNote)
            : keyRootChoice;

        if (selectedRoot !== null) {
            manualRootNote = getHighlightedRoot();
        }

        refreshRootHighlights();
    }

    showRootsBtn.addEventListener("click", () => {
        rootsVisible = !rootsVisible;

        showRootsBtn.setAttribute(
            "aria-pressed", String(rootsVisible)
        );

        showRootsBtn.setAttribute(
            "aria-expanded", String(rootsVisible)
        );

        rootChoiceRow.hidden = !rootsVisible;

        refreshRootHighlights();
    });

    rootChoice.addEventListener("change", () => {
        if (selectedRoot === null) {
            manualRootNote = Number(rootChoice.value);
        } else {
            keyRootChoice = rootChoice.value;
            manualRootNote = getHighlightedRoot();
        }

        refreshRootHighlights();
    });


    keySegments.forEach(segment => {
        segment.addEventListener("click", updateRootChoices);
    });

    scaleOptions.forEach(button => {
        button.addEventListener("click", updateRootChoices);
    });

    document.getElementById("clear").addEventListener(
        "click", updateRootChoices
    );


    fretboard.addEventListener("click", refreshRootHighlights);

    positionSelect.addEventListener(
        "change", updateRootChoices
    );

    positionSystem.addEventListener(
        "change", updateRootChoices
    );

    updateRootChoices();

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

})();

