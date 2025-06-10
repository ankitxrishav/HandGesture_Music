"""
Audio engine module
Handles real-time audio playback and synthesis
"""

import pygame
import numpy as np
import threading
import time
import math
from typing import Dict, List, Optional
from queue import Queue, Empty

class AudioEngine:
    def __init__(self):
        # Initialize pygame mixer
        pygame.mixer.pre_init(frequency=44100, size=-16, channels=2, buffer=512)
        pygame.mixer.init()
        
        # Audio parameters
        self.sample_rate = 44100
        self.channels = 2
        self.bit_depth = 16
        
        # Sound generation parameters
        self.volume = 0.5
        self.note_duration = 0.5  # Default note duration in seconds
        
        # Audio queue for real-time playback
        self.audio_queue = Queue()
        self.playing = False
        self.audio_thread = None
        
        # Currently playing sounds
        self.active_sounds = {}
        self.sound_lock = threading.Lock()
        
        # Note frequencies (A4 = 440 Hz)
        self.note_frequencies = self._generate_note_frequencies()
        
        print("Audio engine initialized")
    
    def _generate_note_frequencies(self) -> Dict[int, float]:
        """Generate frequency mapping for MIDI notes"""
        frequencies = {}
        
        # A4 (MIDI note 69) = 440 Hz
        a4_frequency = 440.0
        a4_midi = 69
        
        for midi_note in range(128):
            # Calculate frequency using equal temperament
            semitone_ratio = 2 ** (1/12)
            frequency = a4_frequency * (semitone_ratio ** (midi_note - a4_midi))
            frequencies[midi_note] = frequency
        
        return frequencies
    
    def start(self):
        """Start the audio engine"""
        if not self.playing:
            self.playing = True
            self.audio_thread = threading.Thread(target=self._audio_loop, daemon=True)
            self.audio_thread.start()
            print("Audio engine started")
    
    def stop(self):
        """Stop the audio engine"""
        self.playing = False
        if self.audio_thread:
            self.audio_thread.join(timeout=1.0)
        
        # Stop all active sounds
        with self.sound_lock:
            for sound in self.active_sounds.values():
                sound.stop()
            self.active_sounds.clear()
        
        pygame.mixer.quit()
        print("Audio engine stopped")
    
    def _audio_loop(self):
        """Main audio processing loop"""
        while self.playing:
            try:
                # Process audio events from queue
                event = self.audio_queue.get(timeout=0.1)
                self._process_audio_event(event)
            except Empty:
                continue
            except Exception as e:
                print(f"Audio loop error: {e}")
    
    def _process_audio_event(self, event: Dict):
        """Process a single audio event"""
        event_type = event.get('type')
        
        if event_type == 'note_on':
            self._play_note(event)
        elif event_type == 'note_off':
            self._stop_note(event)
        elif event_type == 'control_change':
            self._handle_control_change(event)
        elif event_type == 'pitchwheel':
            self._handle_pitch_bend(event)
    
    def play_note(self, event: Dict):
        """Queue a note event for playback"""
        if self.playing:
            self.audio_queue.put(event)
    
    def _play_note(self, event: Dict):
        """Play a MIDI note"""
        note_number = event.get('note')
        velocity = event.get('velocity', 64)
        
        if note_number is None or note_number not in self.note_frequencies:
            return
        
        frequency = self.note_frequencies[note_number]
        
        # Calculate volume from velocity
        volume = (velocity / 127.0) * self.volume
        
        # Generate and play sound
        sound = self._generate_note_sound(frequency, volume)
        
        with self.sound_lock:
            # Stop previous instance of this note if playing
            if note_number in self.active_sounds:
                self.active_sounds[note_number].stop()
            
            # Play new sound
            self.active_sounds[note_number] = sound
            sound.play()
        
        print(f"Playing note {note_number} ({frequency:.2f} Hz) at velocity {velocity}")
    
    def _stop_note(self, event: Dict):
        """Stop playing a specific note"""
        note_number = event.get('note')
        
        if note_number is None:
            return
        
        with self.sound_lock:
            if note_number in self.active_sounds:
                self.active_sounds[note_number].stop()
                del self.active_sounds[note_number]
        
        print(f"Stopped note {note_number}")
    
    def _generate_note_sound(self, frequency: float, volume: float) -> pygame.mixer.Sound:
        """Generate a sound wave for a given frequency"""
        duration = self.note_duration
        sample_count = int(self.sample_rate * duration)
        
        # Generate sine wave with envelope
        samples = np.zeros((sample_count, self.channels), dtype=np.float32)
        
        for i in range(sample_count):
            t = i / self.sample_rate
            
            # Basic sine wave
            wave_value = math.sin(2 * math.pi * frequency * t)
            
            # Add some harmonics for richer sound
            wave_value += 0.3 * math.sin(2 * math.pi * frequency * 2 * t)  # Octave
            wave_value += 0.2 * math.sin(2 * math.pi * frequency * 3 * t)  # Fifth
            wave_value += 0.1 * math.sin(2 * math.pi * frequency * 4 * t)  # Fourth
            
            # Apply envelope (ADSR - Attack, Decay, Sustain, Release)
            envelope = self._calculate_envelope(t, duration)
            
            # Apply volume and envelope
            final_value = wave_value * volume * envelope
            
            # Stereo output
            samples[i][0] = final_value  # Left channel
            samples[i][1] = final_value  # Right channel
        
        # Convert to 16-bit integers
        samples_int = (samples * 32767).astype(np.int16)
        
        # Create pygame sound
        sound = pygame.sndarray.make_sound(samples_int)
        
        return sound
    
    def _calculate_envelope(self, t: float, duration: float) -> float:
        """Calculate ADSR envelope value at time t"""
        attack_time = 0.1
        decay_time = 0.2
        sustain_level = 0.7
        release_time = 0.3
        
        if t < attack_time:
            # Attack phase
            return t / attack_time
        elif t < attack_time + decay_time:
            # Decay phase
            decay_progress = (t - attack_time) / decay_time
            return 1.0 - (1.0 - sustain_level) * decay_progress
        elif t < duration - release_time:
            # Sustain phase
            return sustain_level
        else:
            # Release phase
            release_progress = (t - (duration - release_time)) / release_time
            return sustain_level * (1.0 - release_progress)
    
    def _handle_control_change(self, event: Dict):
        """Handle MIDI control change events"""
        control = event.get('control')
        value = event.get('value', 0)
        
        if control == 7:  # Main volume
            self.volume = value / 127.0
            print(f"Volume changed to {self.volume:.2f}")
        elif control == 64:  # Sustain pedal
            sustain_on = value >= 64
            if sustain_on:
                print("Sustain pedal ON")
            else:
                print("Sustain pedal OFF")
                # Could implement sustain logic here
    
    def _handle_pitch_bend(self, event: Dict):
        """Handle pitch bend events"""
        pitch_value = event.get('pitch', 8192)
        
        # Convert MIDI pitch bend to semitones (-2 to +2)
        semitones = ((pitch_value - 8192) / 8192.0) * 2.0
        
        print(f"Pitch bend: {semitones:.2f} semitones")
        # Could implement pitch bend effect here
    
    def set_volume(self, volume: float):
        """Set master volume (0.0 to 1.0)"""
        self.volume = max(0.0, min(1.0, volume))
    
    def get_volume(self) -> float:
        """Get current master volume"""
        return self.volume
    
    def stop_all_notes(self):
        """Stop all currently playing notes"""
        with self.sound_lock:
            for sound in self.active_sounds.values():
                sound.stop()
            self.active_sounds.clear()
        print("All notes stopped")
    
    def get_active_note_count(self) -> int:
        """Get number of currently playing notes"""
        with self.sound_lock:
            return len(self.active_sounds)
