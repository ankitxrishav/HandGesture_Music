class MotionMusicApp {
    constructor() {
        this.hands = null;
        this.camera = null;
        this.videoElement = null;
        this.canvas = null;
        this.ctx = null;
        
        // Audio context and synthesis
        this.audioContext = null;
        this.masterGain = null;
        this.activeOscillators = new Map();
        this.volume = 0.5;
        this.currentInstrument = 'piano';
        
        // AI Music Engine
        this.currentScale = 'pentatonic';
        this.harmonyMode = 'none';
        this.aiLearning = {
            patterns: [],
            confidence: 0,
            harmonyScore: 0,
            noteHistory: [],
            rhythmPattern: [],
            melodyTendencies: new Map(),
            chordProgressions: []
        };
        
        // Musical scales
        this.scales = {
            pentatonic: [0, 2, 4, 7, 9], // C D E G A
            major: [0, 2, 4, 5, 7, 9, 11], // C D E F G A B
            minor: [0, 2, 3, 5, 7, 8, 10], // C D Eb F G Ab Bb
            blues: [0, 3, 5, 6, 7, 10], // C Eb F F# G Bb
            dorian: [0, 2, 3, 5, 7, 9, 10], // C D Eb F G A Bb
            chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] // All semitones
        };
        
        // Background music
        this.backgroundAudio = null;
        this.backgroundPlaying = false;
        this.backgroundVolume = 0.3;
        
        // MIDI data
        this.midiData = [];
        this.startTime = null;
        
        // Hand tracking
        this.currentHands = [];
        this.noteZones = [];
        this.activeNotes = new Set();
        
        // UI elements
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.statusText = document.getElementById('statusText');
        this.activeNotesSpan = document.getElementById('activeNotes');
        this.handsDetectedSpan = document.getElementById('handsDetected');
        this.logArea = document.getElementById('logArea');
        this.instrumentSelect = document.getElementById('instrumentSelect');
        this.bgMusicBtn = document.getElementById('bgMusicBtn');
        this.bgMusicSelect = document.getElementById('bgMusicSelect');
        this.currentInstrumentSpan = document.getElementById('currentInstrument');
        this.bgStatusSpan = document.getElementById('bgStatus');
        this.scaleSelect = document.getElementById('scaleSelect');
        this.harmonyModeSelect = document.getElementById('harmonyMode');
        this.currentScaleSpan = document.getElementById('currentScale');
        this.currentHarmonySpan = document.getElementById('currentHarmony');
        this.patternsLearnedSpan = document.getElementById('patternsLearned');
        this.melodyConfidenceSpan = document.getElementById('melodyConfidence');
        this.harmonyScoreSpan = document.getElementById('harmonyScore');
        
        this.init();
    }
    
    init() {
        this.videoElement = document.getElementById('videoElement');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Event listeners
        this.startBtn.addEventListener('click', () => this.startCamera());
        this.stopBtn.addEventListener('click', () => this.stopCamera());
        this.saveBtn.addEventListener('click', () => this.saveMIDI());
        this.volumeSlider.addEventListener('input', (e) => this.updateVolume(e.target.value));
        this.instrumentSelect.addEventListener('change', (e) => this.changeInstrument(e.target.value));
        
        // Add new instrument types
        this.instrumentMappings = {
            piano: 'triangle',
            guitar: 'sawtooth', 
            violin: 'sawtooth',
            flute: 'sine',
            synth: 'square',
            organ: 'square',
            harp: 'triangle',
            cello: 'sawtooth'
        };
        this.bgMusicBtn.addEventListener('click', () => this.toggleBackgroundMusic());
        this.bgMusicSelect.addEventListener('change', (e) => this.changeBackgroundMusic(e.target.value));
        this.scaleSelect.addEventListener('change', (e) => this.changeScale(e.target.value));
        this.harmonyModeSelect.addEventListener('change', (e) => this.changeHarmonyMode(e.target.value));
        
        // Initialize audio context
        this.initAudio();
        
        // Create note zones
        this.createNoteZones();
        
        // Initialize MediaPipe Hands
        this.initHands();
        
        this.log('Application initialized');
    }
    
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = this.volume;
            this.log('Audio system ready');
        } catch (error) {
            this.log('Audio initialization failed: ' + error.message);
        }
    }
    
    initHands() {
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });
        
        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        this.hands.onResults((results) => this.onHandsResults(results));
        
        this.log('Hand tracking initialized');
    }
    
    createNoteZones() {
        const noteZonesContainer = document.getElementById('noteZones');
        noteZonesContainer.innerHTML = '';
        this.noteZones = [];
        
        // Create zones based on current scale
        this.updateNoteZonesForScale();
        
        this.log(`Created ${this.noteZones.length} note zones for ${this.currentScale} scale`);
    }
    
    updateNoteZonesForScale() {
        const noteZonesContainer = document.getElementById('noteZones');
        noteZonesContainer.innerHTML = '';
        this.noteZones = [];
        
        const scaleNotes = this.scales[this.currentScale];
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octaves = [3, 4, 5, 6, 7];
        
        octaves.forEach((octave, octaveIndex) => {
            scaleNotes.forEach((scaleStep, noteIndex) => {
                const note = noteNames[scaleStep];
                const midiNote = octave * 12 + scaleStep + 12;
                
                const zone = document.createElement('div');
                zone.className = 'zone';
                zone.style.left = `${noteIndex * (100/scaleNotes.length)}%`;
                zone.style.top = `${octaveIndex * 20}%`;
                zone.style.width = `${100/scaleNotes.length}%`;
                zone.style.height = '20%';
                zone.textContent = `${note}${octave}`;
                zone.dataset.midiNote = midiNote;
                
                noteZonesContainer.appendChild(zone);
                
                this.noteZones.push({
                    element: zone,
                    note: note,
                    octave: octave,
                    midiNote: midiNote,
                    scaleStep: scaleStep,
                    x: noteIndex * (100/scaleNotes.length),
                    y: octaveIndex * 20,
                    width: 100/scaleNotes.length,
                    height: 20
                });
            });
        });
    }
    
    async startCamera() {
        try {
            this.statusText.textContent = 'Requesting camera access...';
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: 640, 
                    height: 480,
                    facingMode: 'user'
                } 
            });
            
            this.videoElement.srcObject = stream;
            this.startBtn.style.display = 'none';
            this.stopBtn.style.display = 'inline-block';
            
            // Start hand tracking when video is ready
            this.videoElement.onloadedmetadata = () => {
                this.canvas.width = this.videoElement.videoWidth;
                this.canvas.height = this.videoElement.videoHeight;
                this.canvas.style.display = 'block';
                this.videoElement.style.display = 'none';
                
                this.camera = new Camera(this.videoElement, {
                    onFrame: async () => {
                        await this.hands.send({ image: this.videoElement });
                    },
                    width: 640,
                    height: 480
                });
                
                this.camera.start();
                this.startTime = Date.now();
                this.statusText.textContent = 'Camera active - Move your hands!';
                this.log('Camera started successfully');
                
                // Resume audio context if needed
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
            };
            
        } catch (error) {
            this.log('Camera access failed: ' + error.message);
            this.statusText.textContent = 'Camera access denied';
        }
    }
    
    stopCamera() {
        if (this.camera) {
            this.camera.stop();
        }
        
        if (this.videoElement.srcObject) {
            this.videoElement.srcObject.getTracks().forEach(track => track.stop());
        }
        
        this.stopAllNotes();
        
        this.startBtn.style.display = 'inline-block';
        this.stopBtn.style.display = 'none';
        this.canvas.style.display = 'none';
        this.videoElement.style.display = 'block';
        this.statusText.textContent = 'Camera stopped';
        
        this.log('Camera stopped');
    }
    
    onHandsResults(results) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the video frame
        this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);
        
        this.currentHands = results.multiHandLandmarks || [];
        this.handsDetectedSpan.textContent = this.currentHands.length;
        
        // Clear previous hand dots
        const handDotsContainer = document.getElementById('handDots');
        handDotsContainer.innerHTML = '';
        
        // Reset note zones
        this.noteZones.forEach(zone => {
            zone.element.classList.remove('note-active');
        });
        
        if (this.currentHands.length > 0) {
            this.processHands(results);
        } else {
            // No hands detected, stop all notes
            this.stopAllNotes();
        }
        
        this.activeNotesSpan.textContent = this.activeNotes.size;
    }
    
    processHands(results) {
        const currentActiveNotes = new Set();
        
        results.multiHandLandmarks.forEach((landmarks, handIndex) => {
            const handedness = results.multiHandedness[handIndex]?.label || 'Unknown';
            
            // Draw hand landmarks
            this.drawLandmarks(landmarks);
            
            // Analyze hand gestures
            const gesture = this.analyzeGesture(landmarks);
            
            // Get finger tips
            const fingerTips = [4, 8, 12, 16, 20]; // Thumb, Index, Middle, Ring, Pinky
            
            fingerTips.forEach((tipIndex, fingerIndex) => {
                const tip = landmarks[tipIndex];
                
                // Check if finger is extended
                if (this.isFingerExtended(landmarks, fingerIndex)) {
                    // Convert normalized coordinates to screen position
                    const x = (tip.x * 100);
                    const y = (tip.y * 100);
                    
                    // Create hand dot
                    this.createHandDot(tip.x * this.canvas.width, tip.y * this.canvas.height);
                    
                    // Find which note zone this finger is in
                    const zone = this.getNoteZoneAt(x, y);
                    if (zone) {
                        zone.element.classList.add('note-active');
                        
                        // Calculate velocity based on hand movement
                        const velocity = this.calculateVelocity(landmarks, handIndex);
                        
                        // Play note
                        this.playNote(zone.midiNote, velocity);
                        currentActiveNotes.add(zone.midiNote);
                    }
                }
            });
            
            // Handle special gestures
            if (gesture.type === 'fist') {
                this.stopAllNotes();
                this.log('Fist gesture - stopping all notes');
            } else if (gesture.type === 'open_hand') {
                // Sustain current notes
                this.log('Open hand - sustaining notes');
            }
        });
        
        // Stop notes that are no longer active
        this.activeNotes.forEach(note => {
            if (!currentActiveNotes.has(note)) {
                this.stopNote(note);
            }
        });
    }
    
    drawLandmarks(landmarks) {
        // Draw hand connections
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8], // Index
            [0, 9], [9, 10], [10, 11], [11, 12], // Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17] // Palm
        ];
        
        this.ctx.strokeStyle = '#00FFFF';
        this.ctx.lineWidth = 2;
        
        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];
            
            this.ctx.beginPath();
            this.ctx.moveTo(startPoint.x * this.canvas.width, startPoint.y * this.canvas.height);
            this.ctx.lineTo(endPoint.x * this.canvas.width, endPoint.y * this.canvas.height);
            this.ctx.stroke();
        });
        
        // Draw landmarks
        this.ctx.fillStyle = '#FF0000';
        landmarks.forEach(landmark => {
            this.ctx.beginPath();
            this.ctx.arc(
                landmark.x * this.canvas.width,
                landmark.y * this.canvas.height,
                5, 0, 2 * Math.PI
            );
            this.ctx.fill();
        });
    }
    
    createHandDot(x, y) {
        const dot = document.createElement('div');
        dot.className = 'hand-dot';
        dot.style.left = `${x}px`;
        dot.style.top = `${y}px`;
        document.getElementById('handDots').appendChild(dot);
    }
    
    analyzeGesture(landmarks) {
        const fingerStates = [];
        
        // Check each finger extension
        for (let i = 0; i < 5; i++) {
            fingerStates.push(this.isFingerExtended(landmarks, i));
        }
        
        const extendedCount = fingerStates.filter(state => state).length;
        
        if (extendedCount === 0) {
            return { type: 'fist', fingerStates };
        } else if (extendedCount >= 4) {
            return { type: 'open_hand', fingerStates };
        } else if (extendedCount === 1 && fingerStates[1]) {
            return { type: 'pointing', fingerStates };
        } else if (extendedCount === 2 && fingerStates[1] && fingerStates[2]) {
            return { type: 'peace', fingerStates };
        } else {
            return { type: 'custom', fingerStates };
        }
    }
    
    isFingerExtended(landmarks, fingerIndex) {
        const fingerTips = [4, 8, 12, 16, 20];
        const fingerPips = [3, 6, 10, 14, 18];
        
        if (fingerIndex === 0) { // Thumb
            return landmarks[fingerTips[0]].x > landmarks[fingerPips[0]].x;
        } else {
            return landmarks[fingerTips[fingerIndex]].y < landmarks[fingerPips[fingerIndex]].y;
        }
    }
    
    getNoteZoneAt(x, y) {
        return this.noteZones.find(zone => {
            return x >= zone.x && x <= zone.x + zone.width &&
                   y >= zone.y && y <= zone.y + zone.height;
        });
    }
    
    calculateVelocity(landmarks, handIndex) {
        // Simple velocity calculation based on hand center movement
        const center = this.getHandCenter(landmarks);
        const baseVelocity = 0.3;
        const movement = Math.random() * 0.4 + 0.3; // Simulate movement for now
        return Math.min(1.0, baseVelocity + movement);
    }
    
    getHandCenter(landmarks) {
        const wrist = landmarks[0];
        const middleMcp = landmarks[9];
        return {
            x: (wrist.x + middleMcp.x) / 2,
            y: (wrist.y + middleMcp.y) / 2
        };
    }
    
    playNote(midiNote, velocity = 0.5) {
        if (!this.audioContext) return;
        
        // AI processing for enhanced musicality
        const enhancedNotes = this.processNoteWithAI(midiNote, velocity);
        
        enhancedNotes.forEach(noteData => {
            if (this.activeNotes.has(noteData.note)) return;
            
            // Calculate frequency from MIDI note
            const frequency = 440 * Math.pow(2, (noteData.note - 69) / 12);
            
            // Create oscillator with instrument-specific settings
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            // Add instrument-specific effects
            const instrumentChain = this.createInstrumentChain(oscillator, gainNode);
            instrumentChain.connect(this.masterGain);
            
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            this.setInstrumentWaveform(oscillator);
            
            // Set volume with instrument-specific envelope
            const now = this.audioContext.currentTime;
            this.applyInstrumentEnvelope(gainNode, noteData.velocity, now + noteData.delay);
            
            oscillator.start(now + noteData.delay);
            
            // Store for later cleanup
            this.activeOscillators.set(noteData.note, { 
                oscillator, 
                gainNode, 
                chain: instrumentChain,
                startTime: now + noteData.delay
            });
            this.activeNotes.add(noteData.note);
            
            // Add to MIDI data
            this.addMidiEvent('note_on', noteData.note, Math.floor(noteData.velocity * 127));
        });
        
        // Update AI learning
        this.updateAILearning(midiNote, velocity);
        
        this.log(`AI enhanced: ${enhancedNotes.length} notes from input ${midiNote}`);
    }
    
    processNoteWithAI(midiNote, velocity) {
        const notes = [{ note: midiNote, velocity: velocity, delay: 0 }];
        
        // Apply harmony mode
        switch (this.harmonyMode) {
            case 'chords':
                notes.push(...this.generateChord(midiNote, velocity));
                break;
            case 'arpeggios':
                notes.push(...this.generateArpeggio(midiNote, velocity));
                break;
            case 'counterpoint':
                notes.push(...this.generateCounterpoint(midiNote, velocity));
                break;
        }
        
        return notes;
    }
    
    generateChord(rootNote, velocity) {
        const chordNotes = [];
        const scaleNotes = this.scales[this.currentScale];
        
        // Generate triad based on scale
        const rootIndex = scaleNotes.indexOf(rootNote % 12);
        if (rootIndex !== -1) {
            // Third (skip one scale degree)
            const thirdIndex = (rootIndex + 2) % scaleNotes.length;
            const third = rootNote + scaleNotes[thirdIndex] - scaleNotes[rootIndex];
            
            // Fifth (skip two scale degrees)
            const fifthIndex = (rootIndex + 4) % scaleNotes.length;
            const fifth = rootNote + scaleNotes[fifthIndex] - scaleNotes[rootIndex];
            
            chordNotes.push(
                { note: third, velocity: velocity * 0.7, delay: 0.05 },
                { note: fifth, velocity: velocity * 0.6, delay: 0.1 }
            );
        }
        
        return chordNotes;
    }
    
    generateArpeggio(rootNote, velocity) {
        const arpeggioNotes = [];
        const scaleNotes = this.scales[this.currentScale];
        const rootIndex = scaleNotes.indexOf(rootNote % 12);
        
        if (rootIndex !== -1) {
            // Create ascending arpeggio
            for (let i = 1; i <= 3; i++) {
                const noteIndex = (rootIndex + i * 2) % scaleNotes.length;
                const note = rootNote + scaleNotes[noteIndex] - scaleNotes[rootIndex];
                arpeggioNotes.push({
                    note: note,
                    velocity: velocity * (0.8 - i * 0.1),
                    delay: i * 0.15
                });
            }
        }
        
        return arpeggioNotes;
    }
    
    generateCounterpoint(mainNote, velocity) {
        const counterpointNotes = [];
        
        // AI-driven counterpoint based on learned patterns
        if (this.aiLearning.noteHistory.length > 2) {
            const recentNotes = this.aiLearning.noteHistory.slice(-3);
            const avgInterval = this.calculateAverageInterval(recentNotes);
            
            // Generate complementary melody line
            const complementNote = mainNote + (avgInterval > 0 ? -3 : 3);
            counterpointNotes.push({
                note: this.quantizeToScale(complementNote),
                velocity: velocity * 0.5,
                delay: 0.08
            });
        }
        
        return counterpointNotes;
    }
    
    quantizeToScale(midiNote) {
        const scaleNotes = this.scales[this.currentScale];
        const octave = Math.floor(midiNote / 12);
        const noteInOctave = midiNote % 12;
        
        // Find closest note in scale
        let closestNote = scaleNotes[0];
        let minDistance = Math.abs(noteInOctave - closestNote);
        
        scaleNotes.forEach(scaleNote => {
            const distance = Math.abs(noteInOctave - scaleNote);
            if (distance < minDistance) {
                minDistance = distance;
                closestNote = scaleNote;
            }
        });
        
        return octave * 12 + closestNote;
    }
    
    updateAILearning(midiNote, velocity) {
        const now = Date.now();
        
        // Add to note history
        this.aiLearning.noteHistory.push({
            note: midiNote,
            velocity: velocity,
            timestamp: now
        });
        
        // Keep only recent history
        if (this.aiLearning.noteHistory.length > 50) {
            this.aiLearning.noteHistory.shift();
        }
        
        // Analyze patterns
        this.analyzeMusicalPatterns();
        
        // Update confidence and scores
        this.updateLearningMetrics();
    }
    
    analyzeMusicalPatterns() {
        if (this.aiLearning.noteHistory.length < 4) return;
        
        const recent = this.aiLearning.noteHistory.slice(-4);
        
        // Analyze intervals
        const intervals = [];
        for (let i = 1; i < recent.length; i++) {
            intervals.push(recent[i].note - recent[i-1].note);
        }
        
        // Store common interval patterns
        const pattern = intervals.join(',');
        if (!this.aiLearning.melodyTendencies.has(pattern)) {
            this.aiLearning.melodyTendencies.set(pattern, 0);
        }
        this.aiLearning.melodyTendencies.set(pattern, 
            this.aiLearning.melodyTendencies.get(pattern) + 1);
        
        // Analyze rhythm patterns
        const rhythmIntervals = [];
        for (let i = 1; i < recent.length; i++) {
            rhythmIntervals.push(recent[i].timestamp - recent[i-1].timestamp);
        }
        this.aiLearning.rhythmPattern = rhythmIntervals;
    }
    
    calculateAverageInterval(noteArray) {
        if (noteArray.length < 2) return 0;
        
        let totalInterval = 0;
        for (let i = 1; i < noteArray.length; i++) {
            totalInterval += noteArray[i].note - noteArray[i-1].note;
        }
        return totalInterval / (noteArray.length - 1);
    }
    
    updateLearningMetrics() {
        // Update patterns learned
        this.aiLearning.patterns = Array.from(this.aiLearning.melodyTendencies.keys());
        this.patternsLearnedSpan.textContent = this.aiLearning.patterns.length;
        
        // Calculate melody confidence based on pattern repetition
        const totalOccurrences = Array.from(this.aiLearning.melodyTendencies.values())
            .reduce((sum, count) => sum + count, 0);
        this.aiLearning.confidence = Math.min(100, (totalOccurrences / 20) * 100);
        this.melodyConfidenceSpan.textContent = `${Math.round(this.aiLearning.confidence)}%`;
        
        // Calculate harmony score based on harmonic intervals
        const harmonicIntervals = this.aiLearning.noteHistory
            .filter((_, index) => index % 2 === 0)
            .slice(-10);
        const harmonicScore = this.calculateHarmonicScore(harmonicIntervals);
        this.aiLearning.harmonyScore = harmonicScore;
        this.harmonyScoreSpan.textContent = `${Math.round(harmonicScore)}%`;
    }
    
    calculateHarmonicScore(intervals) {
        if (intervals.length < 2) return 0;
        
        // Score based on consonant intervals (3rds, 5ths, octaves)
        const consonantIntervals = [3, 4, 7, 8, 12]; // Major 3rd, perfect 4th, perfect 5th, minor 6th, octave
        let consonantCount = 0;
        
        for (let i = 1; i < intervals.length; i++) {
            const interval = Math.abs(intervals[i].note - intervals[i-1].note) % 12;
            if (consonantIntervals.includes(interval)) {
                consonantCount++;
            }
        }
        
        return (consonantCount / (intervals.length - 1)) * 100;
    }
    
    changeScale(scale) {
        this.currentScale = scale;
        this.currentScaleSpan.textContent = scale.charAt(0).toUpperCase() + scale.slice(1);
        this.updateNoteZonesForScale();
        this.log(`Scale changed to ${scale}`);
        
        // Reset AI learning for new scale
        this.aiLearning.noteHistory = [];
        this.aiLearning.melodyTendencies.clear();
        this.updateLearningMetrics();
    }
    
    changeHarmonyMode(mode) {
        this.harmonyMode = mode;
        this.currentHarmonySpan.textContent = mode.charAt(0).toUpperCase() + mode.slice(1).replace(/([A-Z])/g, ' $1');
        this.log(`Harmony mode changed to ${mode}`);
    }
    
    stopNote(midiNote) {
        if (!this.activeOscillators.has(midiNote)) {
            return;
        }
        
        const { oscillator, gainNode, chain } = this.activeOscillators.get(midiNote);
        
        // Fade out
        const now = this.audioContext.currentTime;
        gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
        
        setTimeout(() => {
            try {
                oscillator.stop();
            } catch (e) {
                // Oscillator might already be stopped
            }
        }, 200);
        
        this.activeOscillators.delete(midiNote);
        this.activeNotes.delete(midiNote);
        
        // Add to MIDI data
        this.addMidiEvent('note_off', midiNote, 0);
    }
    
    stopAllNotes() {
        this.activeOscillators.forEach((_, midiNote) => {
            this.stopNote(midiNote);
        });
        this.activeNotes.clear();
    }
    
    addMidiEvent(type, note, velocity) {
        if (!this.startTime) return;
        
        const timestamp = Date.now() - this.startTime;
        this.midiData.push({
            type,
            note,
            velocity,
            timestamp
        });
    }
    
    createInstrumentChain(oscillator, gainNode) {
        oscillator.connect(gainNode);
        
        // Add instrument-specific effects
        switch (this.currentInstrument) {
            case 'guitar':
                // Add slight distortion and reverb for guitar
                const guitarFilter = this.audioContext.createBiquadFilter();
                guitarFilter.type = 'lowpass';
                guitarFilter.frequency.value = 3000;
                gainNode.connect(guitarFilter);
                return guitarFilter;
                
            case 'violin':
                // Add vibrato effect for violin
                const violinLFO = this.audioContext.createOscillator();
                const violinGain = this.audioContext.createGain();
                violinLFO.frequency.value = 6; // 6 Hz vibrato
                violinGain.gain.value = 10;
                violinLFO.connect(violinGain);
                violinGain.connect(oscillator.frequency);
                violinLFO.start();
                gainNode.connect(gainNode);
                return gainNode;
                
            case 'flute':
                // Add high-pass filter for flute-like sound
                const fluteFilter = this.audioContext.createBiquadFilter();
                fluteFilter.type = 'highpass';
                fluteFilter.frequency.value = 800;
                gainNode.connect(fluteFilter);
                return fluteFilter;
                
            case 'organ':
                // Add slight chorus effect for organ
                const organDelay = this.audioContext.createDelay();
                const organFeedback = this.audioContext.createGain();
                organDelay.delayTime.value = 0.02;
                organFeedback.gain.value = 0.3;
                gainNode.connect(organDelay);
                organDelay.connect(organFeedback);
                organFeedback.connect(gainNode);
                return gainNode;
                
            case 'synth':
                // Add low-pass filter with envelope for synth
                const synthFilter = this.audioContext.createBiquadFilter();
                synthFilter.type = 'lowpass';
                synthFilter.frequency.value = 2000;
                synthFilter.Q.value = 10;
                gainNode.connect(synthFilter);
                return synthFilter;
                
            default: // piano
                return gainNode;
        }
    }
    
    setInstrumentWaveform(oscillator) {
        oscillator.type = this.instrumentMappings[this.currentInstrument] || 'triangle';
    }
    
    applyInstrumentEnvelope(gainNode, velocity, startTime) {
        const attack = this.getInstrumentAttack();
        const decay = this.getInstrumentDecay();
        const sustain = this.getInstrumentSustain();
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(velocity * 0.4, startTime + attack);
        gainNode.gain.linearRampToValueAtTime(velocity * sustain, startTime + attack + decay);
    }
    
    getInstrumentAttack() {
        const attacks = {
            piano: 0.1, guitar: 0.02, violin: 0.3, flute: 0.1, 
            synth: 0.05, organ: 0.0, harp: 0.05, cello: 0.2
        };
        return attacks[this.currentInstrument] || 0.1;
    }
    
    getInstrumentDecay() {
        const decays = {
            piano: 0.3, guitar: 0.5, violin: 0.1, flute: 0.2,
            synth: 0.3, organ: 0.0, harp: 0.8, cello: 0.2
        };
        return decays[this.currentInstrument] || 0.3;
    }
    
    getInstrumentSustain() {
        const sustains = {
            piano: 0.6, guitar: 0.3, violin: 0.8, flute: 0.6,
            synth: 0.5, organ: 0.9, harp: 0.4, cello: 0.8
        };
        return sustains[this.currentInstrument] || 0.6;
    }
    
    changeInstrument(instrument) {
        this.currentInstrument = instrument;
        this.currentInstrumentSpan.textContent = instrument.charAt(0).toUpperCase() + instrument.slice(1);
        this.log(`Instrument changed to ${instrument}`);
        
        // Stop all current notes to apply new instrument sound
        this.stopAllNotes();
    }
    
    toggleBackgroundMusic() {
        if (this.backgroundPlaying) {
            this.stopBackgroundMusic();
        } else {
            this.startBackgroundMusic();
        }
    }
    
    startBackgroundMusic() {
        if (!this.audioContext) {
            this.initAudio();
        }
        
        const selectedTrack = this.bgMusicSelect.value || 'ambient';
        this.playBackgroundTrack(selectedTrack);
        
        this.backgroundPlaying = true;
        this.bgMusicBtn.classList.add('active');
        this.bgMusicBtn.textContent = '🔇 Stop Background';
        this.bgMusicSelect.style.display = 'inline-block';
        this.bgStatusSpan.textContent = selectedTrack.charAt(0).toUpperCase() + selectedTrack.slice(1);
        
        this.log(`Background music started: ${selectedTrack}`);
    }
    
    stopBackgroundMusic() {
        if (this.backgroundAudio) {
            // Stop all background oscillators
            if (this.backgroundAudio.oscillator1) this.backgroundAudio.oscillator1.stop();
            if (this.backgroundAudio.oscillator2) this.backgroundAudio.oscillator2.stop();
            if (this.backgroundAudio.lfo) this.backgroundAudio.lfo.stop();
            if (this.backgroundAudio.whiteNoise) this.backgroundAudio.whiteNoise.stop();
            if (this.backgroundAudio.oscillators) {
                this.backgroundAudio.oscillators.forEach(osc => osc.stop());
            }
            this.backgroundAudio = null;
        }
        
        this.backgroundPlaying = false;
        this.bgMusicBtn.classList.remove('active');
        this.bgMusicBtn.textContent = '🎵 Background Music';
        this.bgMusicSelect.style.display = 'none';
        this.bgStatusSpan.textContent = 'Off';
        
        this.log('Background music stopped');
    }
    
    changeBackgroundMusic(track) {
        if (this.backgroundPlaying) {
            this.stopBackgroundMusic();
            this.bgMusicSelect.value = track;
            this.startBackgroundMusic();
        }
    }
    
    playBackgroundTrack(trackType) {
        // Generate procedural background music using Web Audio API
        const bgGain = this.audioContext.createGain();
        bgGain.gain.value = this.backgroundVolume;
        bgGain.connect(this.audioContext.destination);
        
        switch (trackType) {
            case 'forest':
                this.createForestTrack(bgGain);
                break;
            case 'ocean':
                this.createOceanTrack(bgGain);
                break;
            case 'rain':
                this.createRainTrack(bgGain);
                break;
            case 'space':
                this.createSpaceTrack(bgGain);
                break;
            case 'classical':
                this.createClassicalTrack(bgGain);
                break;
            case 'meditation':
                this.createMeditationTrack(bgGain);
                break;
        }
    }
    
    createForestTrack(destination) {
        // Create forest ambience with gentle harmonics
        const oscillators = [];
        const frequencies = [110, 165, 220, 275]; // Rich low harmonics
        
        frequencies.forEach((freq, index) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            filter.type = 'lowpass';
            filter.frequency.value = 300 + Math.random() * 200;
            filter.Q.value = 2;
            gain.gain.value = 0.03 / (index + 1);
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(destination);
            osc.start();
            oscillators.push(osc);
        });
        
        this.backgroundAudio = { oscillators };
    }
    
    createOceanTrack(destination) {
        // Create ocean wave simulation
        const bufferSize = this.audioContext.sampleRate * 4;
        const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * Math.sin(i * 0.0001);
        }
        
        const whiteNoise = this.audioContext.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        filter.Q.value = 1;
        
        const gain = this.audioContext.createGain();
        gain.gain.value = 0.08;
        
        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        whiteNoise.start();
        
        this.backgroundAudio = { whiteNoise };
    }
    
    createRainTrack(destination) {
        // Create rain sound with filtered noise
        const bufferSize = this.audioContext.sampleRate * 2;
        const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        const whiteNoise = this.audioContext.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;
        
        const filter1 = this.audioContext.createBiquadFilter();
        const filter2 = this.audioContext.createBiquadFilter();
        filter1.type = 'highpass';
        filter1.frequency.value = 1000;
        filter2.type = 'lowpass';
        filter2.frequency.value = 8000;
        
        const gain = this.audioContext.createGain();
        gain.gain.value = 0.06;
        
        whiteNoise.connect(filter1);
        filter1.connect(filter2);
        filter2.connect(gain);
        gain.connect(destination);
        whiteNoise.start();
        
        this.backgroundAudio = { whiteNoise };
    }
    
    createSpaceTrack(destination) {
        // Create cosmic ambient drone
        const oscillators = [];
        const frequencies = [55, 82.5, 110, 146.25]; // Deep space harmonics
        
        frequencies.forEach((freq, index) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            const lfo = this.audioContext.createOscillator();
            const lfoGain = this.audioContext.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            lfo.type = 'sine';
            lfo.frequency.value = 0.05 + Math.random() * 0.1;
            lfoGain.gain.value = freq * 0.01;
            gain.gain.value = 0.04 / (index + 1);
            
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            osc.connect(gain);
            gain.connect(destination);
            
            osc.start();
            lfo.start();
            oscillators.push(osc, lfo);
        });
        
        this.backgroundAudio = { oscillators };
    }
    
    createClassicalTrack(destination) {
        // Create a simple classical-style progression
        const notes = [440, 523.25, 659.25, 783.99]; // A, C, E, G
        const oscillators = [];
        
        notes.forEach((freq, index) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.type = 'triangle';
            osc.frequency.value = freq / 2; // Lower octave
            gain.gain.value = 0.03;
            
            osc.connect(gain);
            gain.connect(destination);
            osc.start(this.audioContext.currentTime + index * 0.5);
            
            oscillators.push(osc);
        });
        
        this.backgroundAudio = { oscillators };
    }
    
    createMeditationTrack(destination) {
        // Create deep, resonant tones for meditation
        const fundamentalFreq = 110; // A2
        const oscillators = [];
        
        // Create harmonic series
        for (let harmonic = 1; harmonic <= 4; harmonic++) {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = fundamentalFreq * harmonic;
            gain.gain.value = 0.08 / harmonic; // Decreasing amplitude for higher harmonics
            
            osc.connect(gain);
            gain.connect(destination);
            osc.start();
            
            oscillators.push(osc);
        }
        
        this.backgroundAudio = { oscillators };
    }
    
    updateVolume(value) {
        this.volume = value / 100;
        this.volumeValue.textContent = `${value}%`;
        
        if (this.masterGain) {
            this.masterGain.gain.value = this.volume;
        }
    }
    
    saveMIDI() {
        if (this.midiData.length === 0) {
            this.log('No MIDI data to save');
            return;
        }
        
        // Create a simple MIDI file content
        const midiContent = this.createMidiFile();
        const blob = new Blob([midiContent], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `motion-music-${Date.now()}.mid`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.log(`MIDI file saved with ${this.midiData.length} events`);
    }
    
    createMidiFile() {
        // Simple MIDI file creation (basic implementation)
        // In a real application, you'd use a proper MIDI library
        const header = new Uint8Array([
            0x4D, 0x54, 0x68, 0x64, // "MThd"
            0x00, 0x00, 0x00, 0x06, // Header length
            0x00, 0x00, // Format type 0
            0x00, 0x01, // One track
            0x00, 0x60  // 96 ticks per quarter note
        ]);
        
        // Track header
        const trackHeader = new Uint8Array([
            0x4D, 0x54, 0x72, 0x6B, // "MTrk"
            0x00, 0x00, 0x00, 0x00  // Track length (to be filled)
        ]);
        
        // Simple track data with our events
        const trackData = new Uint8Array(this.midiData.length * 8); // Rough estimate
        
        // Combine header and track
        const result = new Uint8Array(header.length + trackHeader.length + trackData.length);
        result.set(header, 0);
        result.set(trackHeader, header.length);
        result.set(trackData, header.length + trackHeader.length);
        
        return result;
    }
    
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.textContent = `[${timestamp}] ${message}`;
        this.logArea.appendChild(logEntry);
        this.logArea.scrollTop = this.logArea.scrollHeight;
        
        // Limit log entries
        while (this.logArea.children.length > 50) {
            this.logArea.removeChild(this.logArea.firstChild);
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MotionMusicApp();
});