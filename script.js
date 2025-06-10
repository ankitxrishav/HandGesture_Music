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
        
        // Create a grid of note zones (7x5 = 35 notes)
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octaves = [3, 4, 5, 6, 7];
        
        octaves.forEach((octave, octaveIndex) => {
            for (let noteIndex = 0; noteIndex < 7; noteIndex++) {
                const note = notes[noteIndex * 2 % 12]; // Skip some notes for simplicity
                const midiNote = octave * 12 + (noteIndex * 2) + 12; // Convert to MIDI note number
                
                const zone = document.createElement('div');
                zone.className = 'zone';
                zone.style.left = `${noteIndex * 14.28}%`;
                zone.style.top = `${octaveIndex * 20}%`;
                zone.style.width = '14.28%';
                zone.style.height = '20%';
                zone.textContent = `${note}${octave}`;
                zone.dataset.midiNote = midiNote;
                
                noteZonesContainer.appendChild(zone);
                
                this.noteZones.push({
                    element: zone,
                    note: note,
                    octave: octave,
                    midiNote: midiNote,
                    x: noteIndex * 14.28,
                    y: octaveIndex * 20,
                    width: 14.28,
                    height: 20
                });
            }
        });
        
        this.log(`Created ${this.noteZones.length} note zones`);
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
        if (!this.audioContext || this.activeNotes.has(midiNote)) {
            return;
        }
        
        // Calculate frequency from MIDI note
        const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
        
        // Create oscillator
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = 'sine';
        
        // Set volume with envelope
        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(velocity * 0.3, now + 0.1);
        
        oscillator.start();
        
        // Store for later cleanup
        this.activeOscillators.set(midiNote, { oscillator, gainNode });
        this.activeNotes.add(midiNote);
        
        // Add to MIDI data
        this.addMidiEvent('note_on', midiNote, Math.floor(velocity * 127));
        
        this.log(`Playing note ${midiNote} (${frequency.toFixed(1)} Hz)`);
    }
    
    stopNote(midiNote) {
        if (!this.activeOscillators.has(midiNote)) {
            return;
        }
        
        const { oscillator, gainNode } = this.activeOscillators.get(midiNote);
        
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