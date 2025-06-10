"""
Gesture recognition module
Analyzes hand landmarks to recognize musical gestures and movements
"""

import numpy as np
import time
from typing import Dict, List, Tuple, Optional

class GestureRecognizer:
    def __init__(self):
        self.previous_positions = {}
        self.gesture_history = []
        self.last_gesture_time = time.time()
        
        # Gesture thresholds
        self.movement_threshold = 10.0  # pixels
        self.velocity_threshold = 50.0  # pixels per second
        self.gesture_cooldown = 0.1  # seconds between gesture detections
        
        # Musical mapping zones (normalized coordinates)
        self.note_zones = self._create_note_zones()
        
    def _create_note_zones(self) -> Dict:
        """Create zones on screen that map to different musical notes"""
        # Divide screen into a musical grid
        zones = {}
        
        # Create a 7x5 grid for notes (7 octaves, 5 zones per octave)
        for octave in range(7):
            for zone in range(5):
                note_index = octave * 12 + zone * 2  # Skip some notes for simplicity
                note_name = self._get_note_name(note_index)
                
                x_start = zone * 0.2
                x_end = (zone + 1) * 0.2
                y_start = octave * 0.14
                y_end = (octave + 1) * 0.14
                
                zones[note_name] = {
                    'x_range': (x_start, x_end),
                    'y_range': (y_start, y_end),
                    'note_number': note_index + 60  # Middle C starts at 60
                }
        
        return zones
    
    def _get_note_name(self, note_index: int) -> str:
        """Convert note index to note name"""
        notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        octave = note_index // 12
        note = notes[note_index % 12]
        return f"{note}{octave}"
    
    def analyze_hand(self, hand_data: Dict) -> Dict:
        """
        Analyze hand data and recognize musical gestures
        
        Args:
            hand_data: Dictionary containing hand landmarks and features
            
        Returns:
            Dictionary containing recognized gestures and musical parameters
        """
        current_time = time.time()
        handedness = hand_data.get('handedness', 'Unknown')
        
        gestures = {
            'handedness': handedness,
            'timestamp': current_time,
            'notes': [],
            'controls': {},
            'movements': {}
        }
        
        # Analyze finger positions for note triggering
        finger_notes = self._analyze_finger_positions(hand_data)
        gestures['notes'].extend(finger_notes)
        
        # Analyze hand movements for controls
        movement_controls = self._analyze_hand_movement(hand_data, handedness)
        gestures['controls'].update(movement_controls)
        
        # Analyze gesture patterns
        gesture_patterns = self._recognize_gesture_patterns(hand_data)
        gestures.update(gesture_patterns)
        
        # Store position history
        self.previous_positions[handedness] = {
            'center': hand_data['center'],
            'timestamp': current_time,
            'finger_positions': hand_data['finger_positions']
        }
        
        return gestures
    
    def _analyze_finger_positions(self, hand_data: Dict) -> List[Dict]:
        """Analyze finger positions to trigger notes"""
        notes = []
        finger_positions = hand_data.get('finger_positions', {})
        finger_states = hand_data.get('gesture_features', {}).get('finger_states', {})
        
        if not finger_positions or 'tips' not in finger_positions:
            return notes
        
        frame_width = 640  # Assume standard width
        frame_height = 480  # Assume standard height
        
        for finger_name, tip_position in finger_positions['tips'].items():
            if finger_states.get(finger_name, False):  # Finger is extended
                # Normalize position
                norm_x = tip_position[0] / frame_width
                norm_y = tip_position[1] / frame_height
                
                # Find corresponding note zone
                note_info = self._position_to_note(norm_x, norm_y)
                if note_info:
                    # Calculate velocity based on hand size and movement
                    velocity = self._calculate_note_velocity(hand_data, finger_name)
                    
                    notes.append({
                        'note_number': note_info['note_number'],
                        'note_name': note_info['note_name'],
                        'velocity': velocity,
                        'finger': finger_name,
                        'position': (norm_x, norm_y)
                    })
        
        return notes
    
    def _position_to_note(self, x: float, y: float) -> Optional[Dict]:
        """Convert screen position to musical note"""
        for note_name, zone in self.note_zones.items():
            x_range = zone['x_range']
            y_range = zone['y_range']
            
            if (x_range[0] <= x <= x_range[1] and 
                y_range[0] <= y <= y_range[1]):
                return {
                    'note_name': note_name,
                    'note_number': zone['note_number']
                }
        
        return None
    
    def _calculate_note_velocity(self, hand_data: Dict, finger_name: str) -> int:
        """Calculate MIDI velocity based on hand dynamics"""
        base_velocity = 64  # Default velocity
        
        # Factor in hand size (larger hands = louder)
        hand_size = hand_data.get('gesture_features', {}).get('hand_size', 100)
        size_factor = min(hand_size / 100.0, 2.0)  # Cap at 2x
        
        # Factor in movement speed
        handedness = hand_data.get('handedness', 'Unknown')
        if handedness in self.previous_positions:
            prev_data = self.previous_positions[handedness]
            current_center = hand_data['center']
            prev_center = prev_data['center']
            time_diff = time.time() - prev_data['timestamp']
            
            if time_diff > 0:
                speed = np.sqrt((current_center[0] - prev_center[0])**2 + 
                              (current_center[1] - prev_center[1])**2) / time_diff
                speed_factor = min(speed / 100.0, 2.0)  # Normalize and cap
            else:
                speed_factor = 1.0
        else:
            speed_factor = 1.0
        
        # Calculate final velocity
        velocity = int(base_velocity * size_factor * speed_factor)
        return max(1, min(127, velocity))  # Clamp to MIDI range
    
    def _analyze_hand_movement(self, hand_data: Dict, handedness: str) -> Dict:
        """Analyze hand movement for musical controls"""
        controls = {}
        
        current_center = hand_data['center']
        current_time = time.time()
        
        if handedness in self.previous_positions:
            prev_data = self.previous_positions[handedness]
            prev_center = prev_data['center']
            time_diff = current_time - prev_data['timestamp']
            
            if time_diff > 0:
                # Calculate velocity
                dx = current_center[0] - prev_center[0]
                dy = current_center[1] - prev_center[1]
                velocity = np.sqrt(dx**2 + dy**2) / time_diff
                
                # Map movement to controls
                if velocity > self.velocity_threshold:
                    # Horizontal movement controls pitch bend
                    if abs(dx) > abs(dy):
                        direction = 1 if dx > 0 else -1
                        controls['pitch_bend'] = direction * min(velocity / 100.0, 1.0)
                    
                    # Vertical movement controls modulation
                    else:
                        direction = 1 if dy < 0 else -1  # Up is positive
                        controls['modulation'] = direction * min(velocity / 100.0, 1.0)
                
                # Map position to continuous controls
                frame_width, frame_height = 640, 480
                norm_x = current_center[0] / frame_width
                norm_y = current_center[1] / frame_height
                
                controls['position_x'] = norm_x
                controls['position_y'] = norm_y
                
                # Map Y position to volume (higher = louder)
                controls['volume'] = max(0.1, 1.0 - norm_y)
        
        return controls
    
    def _recognize_gesture_patterns(self, hand_data: Dict) -> Dict:
        """Recognize complex gesture patterns"""
        patterns = {}
        
        finger_states = hand_data.get('gesture_features', {}).get('finger_states', {})
        
        # Count extended fingers
        extended_count = sum(1 for extended in finger_states.values() if extended)
        patterns['extended_fingers'] = extended_count
        
        # Recognize specific gestures
        if self._is_fist(finger_states):
            patterns['gesture_type'] = 'fist'
            patterns['action'] = 'stop_all_notes'
        elif self._is_open_hand(finger_states):
            patterns['gesture_type'] = 'open_hand'
            patterns['action'] = 'sustain_notes'
        elif self._is_pointing(finger_states):
            patterns['gesture_type'] = 'pointing'
            patterns['action'] = 'single_note'
        elif self._is_peace_sign(finger_states):
            patterns['gesture_type'] = 'peace'
            patterns['action'] = 'chord_mode'
        else:
            patterns['gesture_type'] = 'custom'
            patterns['action'] = 'multi_note'
        
        return patterns
    
    def _is_fist(self, finger_states: Dict) -> bool:
        """Check if hand is making a fist"""
        return sum(finger_states.values()) == 0
    
    def _is_open_hand(self, finger_states: Dict) -> bool:
        """Check if hand is open"""
        return sum(finger_states.values()) >= 4
    
    def _is_pointing(self, finger_states: Dict) -> bool:
        """Check if hand is pointing (index finger extended)"""
        return (finger_states.get('index', False) and 
                not finger_states.get('middle', False) and
                not finger_states.get('ring', False) and
                not finger_states.get('pinky', False))
    
    def _is_peace_sign(self, finger_states: Dict) -> bool:
        """Check if hand is making peace sign (index and middle extended)"""
        return (finger_states.get('index', False) and 
                finger_states.get('middle', False) and
                not finger_states.get('ring', False) and
                not finger_states.get('pinky', False))
