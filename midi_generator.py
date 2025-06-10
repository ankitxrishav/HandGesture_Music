"""
MIDI generation module
Converts gestures and hand movements into MIDI messages
"""

import mido
import time
import os
import tempfile
from typing import Dict, List, Optional, Tuple
from threading import Lock

class MIDIGenerator:
    def __init__(self):
        self.current_notes = set()  # Track currently playing notes
        self.note_lock = Lock()
        
        # MIDI settings
        self.default_velocity = 64
        self.default_channel = 0
        self.sustain_pedal = False
        
        # Create temporary MIDI file for output
        self.temp_dir = tempfile.mkdtemp()
        self.midi_file_path = os.path.join(self.temp_dir, "motion_music.mid")
        
        # Initialize MIDI file
        self.midi_file = mido.MidiFile()
        self.track = mido.MidiTrack()
        self.midi_file.tracks.append(self.track)
        
        # Timing
        self.last_event_time = time.time()
        self.tempo = 500000  # 120 BPM in microseconds per beat
        
        # Add initial tempo and program change
        self._add_initial_setup()
        
        print(f"MIDI Generator initialized. Output file: {self.midi_file_path}")
    
    def _add_initial_setup(self):
        """Add initial MIDI setup messages"""
        # Set tempo
        tempo_msg = mido.MetaMessage('set_tempo', tempo=self.tempo)
        self.track.append(tempo_msg)
        
        # Set instrument (piano)
        program_change = mido.Message('program_change', channel=self.default_channel, program=0)
        self.track.append(program_change)
    
    def process_gestures(self, gestures: Dict) -> List[Dict]:
        """
        Process gesture data and generate MIDI events
        
        Args:
            gestures: Dictionary containing gesture information
            
        Returns:
            List of MIDI event dictionaries
        """
        midi_events = []
        current_time = time.time()
        
        # Handle special gesture actions
        action = gestures.get('action')
        if action == 'stop_all_notes':
            midi_events.extend(self._stop_all_notes())
        elif action == 'sustain_notes':
            self.sustain_pedal = True
            midi_events.append(self._create_sustain_event(True))
        else:
            self.sustain_pedal = False
            midi_events.append(self._create_sustain_event(False))
        
        # Process note events
        notes = gestures.get('notes', [])
        for note_data in notes:
            midi_event = self._create_note_event(note_data, current_time)
            if midi_event:
                midi_events.append(midi_event)
        
        # Process control changes
        controls = gestures.get('controls', {})
        control_events = self._process_controls(controls)
        midi_events.extend(control_events)
        
        # Add events to MIDI file
        for event in midi_events:
            self._add_to_midi_file(event)
        
        return midi_events
    
    def _create_note_event(self, note_data: Dict, timestamp: float) -> Optional[Dict]:
        """Create a MIDI note event from gesture data"""
        note_number = note_data.get('note_number')
        velocity = note_data.get('velocity', self.default_velocity)
        
        if note_number is None:
            return None
        
        # Ensure note is in valid MIDI range
        note_number = max(0, min(127, note_number))
        velocity = max(1, min(127, velocity))
        
        with self.note_lock:
            # Check if note is already playing
            if note_number in self.current_notes:
                # Note is already playing, don't trigger again
                return None
            
            # Add note to currently playing set
            self.current_notes.add(note_number)
        
        midi_event = {
            'type': 'note_on',
            'note': note_number,
            'velocity': velocity,
            'channel': self.default_channel,
            'timestamp': timestamp,
            'note_name': note_data.get('note_name', f'Note_{note_number}'),
            'finger': note_data.get('finger', 'unknown')
        }
        
        return midi_event
    
    def _stop_note(self, note_number: int) -> Dict:
        """Create a note off event"""
        with self.note_lock:
            self.current_notes.discard(note_number)
        
        return {
            'type': 'note_off',
            'note': note_number,
            'velocity': 0,
            'channel': self.default_channel,
            'timestamp': time.time()
        }
    
    def _stop_all_notes(self) -> List[Dict]:
        """Stop all currently playing notes"""
        events = []
        
        with self.note_lock:
            for note_number in list(self.current_notes):
                events.append(self._stop_note(note_number))
            self.current_notes.clear()
        
        return events
    
    def _create_sustain_event(self, sustain_on: bool) -> Dict:
        """Create sustain pedal control event"""
        return {
            'type': 'control_change',
            'control': 64,  # Sustain pedal
            'value': 127 if sustain_on else 0,
            'channel': self.default_channel,
            'timestamp': time.time()
        }
    
    def _process_controls(self, controls: Dict) -> List[Dict]:
        """Process continuous control data"""
        events = []
        
        # Pitch bend
        if 'pitch_bend' in controls:
            pitch_value = int(controls['pitch_bend'] * 8192 + 8192)  # Convert to MIDI range
            pitch_value = max(0, min(16383, pitch_value))
            
            events.append({
                'type': 'pitchwheel',
                'pitch': pitch_value,
                'channel': self.default_channel,
                'timestamp': time.time()
            })
        
        # Modulation
        if 'modulation' in controls:
            mod_value = int(abs(controls['modulation']) * 127)
            mod_value = max(0, min(127, mod_value))
            
            events.append({
                'type': 'control_change',
                'control': 1,  # Modulation wheel
                'value': mod_value,
                'channel': self.default_channel,
                'timestamp': time.time()
            })
        
        # Volume
        if 'volume' in controls:
            vol_value = int(controls['volume'] * 127)
            vol_value = max(0, min(127, vol_value))
            
            events.append({
                'type': 'control_change',
                'control': 7,  # Main volume
                'value': vol_value,
                'channel': self.default_channel,
                'timestamp': time.time()
            })
        
        return events
    
    def _add_to_midi_file(self, event: Dict):
        """Add MIDI event to the output file"""
        current_time = time.time()
        delta_time = int((current_time - self.last_event_time) * 480)  # Convert to ticks
        delta_time = max(0, delta_time)
        
        try:
            event_type = event['type']
            
            if event_type == 'note_on':
                msg = mido.Message('note_on',
                                 channel=event['channel'],
                                 note=event['note'],
                                 velocity=event['velocity'],
                                 time=delta_time)
            
            elif event_type == 'note_off':
                msg = mido.Message('note_off',
                                 channel=event['channel'],
                                 note=event['note'],
                                 velocity=event['velocity'],
                                 time=delta_time)
            
            elif event_type == 'control_change':
                msg = mido.Message('control_change',
                                 channel=event['channel'],
                                 control=event['control'],
                                 value=event['value'],
                                 time=delta_time)
            
            elif event_type == 'pitchwheel':
                msg = mido.Message('pitchwheel',
                                 channel=event['channel'],
                                 pitch=event['pitch'],
                                 time=delta_time)
            
            else:
                return  # Unknown event type
            
            self.track.append(msg)
            self.last_event_time = current_time
            
        except Exception as e:
            print(f"Error adding MIDI event: {e}")
    
    def save_midi_file(self):
        """Save the current MIDI data to file"""
        try:
            self.midi_file.save(self.midi_file_path)
            print(f"MIDI file saved: {self.midi_file_path}")
        except Exception as e:
            print(f"Error saving MIDI file: {e}")
    
    def get_currently_playing_notes(self) -> set:
        """Get set of currently playing notes"""
        with self.note_lock:
            return self.current_notes.copy()
    
    def clear_all_notes(self):
        """Clear all note tracking"""
        with self.note_lock:
            self.current_notes.clear()
    
    def get_midi_file_path(self) -> str:
        """Get path to the generated MIDI file"""
        return self.midi_file_path
    
    def create_chord(self, root_note: int, chord_type: str = 'major') -> List[Dict]:
        """Create a chord based on root note and type"""
        chord_intervals = {
            'major': [0, 4, 7],
            'minor': [0, 3, 7],
            'seventh': [0, 4, 7, 10],
            'diminished': [0, 3, 6]
        }
        
        intervals = chord_intervals.get(chord_type, [0, 4, 7])
        chord_events = []
        
        for interval in intervals:
            note_number = root_note + interval
            if 0 <= note_number <= 127:
                chord_events.append({
                    'type': 'note_on',
                    'note': note_number,
                    'velocity': self.default_velocity,
                    'channel': self.default_channel,
                    'timestamp': time.time()
                })
        
        return chord_events
