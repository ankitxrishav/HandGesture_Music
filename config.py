"""
Configuration module
Contains application settings and constants
"""

import os

class Config:
    """Application configuration settings"""
    
    # Camera settings
    CAMERA_WIDTH = 640
    CAMERA_HEIGHT = 480
    CAMERA_FPS = 30
    
    # Hand tracking settings
    MAX_HANDS = 2
    MIN_DETECTION_CONFIDENCE = 0.7
    MIN_TRACKING_CONFIDENCE = 0.5
    
    # Audio settings
    SAMPLE_RATE = 44100
    AUDIO_CHANNELS = 2
    AUDIO_BUFFER_SIZE = 512
    DEFAULT_VOLUME = 0.5
    NOTE_DURATION = 0.5  # seconds
    
    # MIDI settings
    DEFAULT_VELOCITY = 64
    DEFAULT_CHANNEL = 0
    MIDI_NOTE_RANGE = (21, 108)  # A0 to C8
    
    # Gesture recognition settings
    MOVEMENT_THRESHOLD = 10.0  # pixels
    VELOCITY_THRESHOLD = 50.0  # pixels per second
    GESTURE_COOLDOWN = 0.1  # seconds
    
    # Visual feedback settings
    LANDMARK_COLOR = (0, 255, 0)  # Green
    CONNECTION_COLOR = (0, 255, 255)  # Yellow
    CENTER_COLOR = (255, 0, 0)  # Red
    BBOX_COLOR = (255, 255, 0)  # Cyan
    
    # Performance settings
    MAX_CONCURRENT_NOTES = 10
    FRAME_BUFFER_SIZE = 5
    
    # File paths
    TEMP_DIR = os.path.join(os.path.expanduser("~"), ".motion_music_temp")
    DEFAULT_MIDI_FILENAME = "motion_music_output.mid"
    
    # Note mapping settings
    OCTAVE_COUNT = 7
    NOTES_PER_OCTAVE = 12
    BASE_NOTE = 60  # Middle C
    
    # Audio synthesis settings
    WAVEFORM_TYPE = "sine"  # sine, square, sawtooth, triangle
    ATTACK_TIME = 0.1
    DECAY_TIME = 0.2
    SUSTAIN_LEVEL = 0.7
    RELEASE_TIME = 0.3
    
    # Control mapping settings
    PITCH_BEND_RANGE = 2.0  # semitones
    MODULATION_SENSITIVITY = 1.0
    VOLUME_SENSITIVITY = 1.0
    
    # Debug settings
    DEBUG_MODE = os.getenv("DEBUG", "false").lower() == "true"
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    SHOW_FPS = True
    SHOW_LANDMARKS = True
    
    @classmethod
    def create_temp_directory(cls):
        """Create temporary directory if it doesn't exist"""
        if not os.path.exists(cls.TEMP_DIR):
            os.makedirs(cls.TEMP_DIR)
        return cls.TEMP_DIR
    
    @classmethod
    def get_midi_output_path(cls):
        """Get full path for MIDI output file"""
        cls.create_temp_directory()
        return os.path.join(cls.TEMP_DIR, cls.DEFAULT_MIDI_FILENAME)
    
    @classmethod
    def validate_note_range(cls, note_number):
        """Validate MIDI note number is in valid range"""
        return max(cls.MIDI_NOTE_RANGE[0], min(cls.MIDI_NOTE_RANGE[1], note_number))
    
    @classmethod
    def validate_velocity(cls, velocity):
        """Validate MIDI velocity is in valid range"""
        return max(1, min(127, velocity))
    
    @classmethod
    def validate_control_value(cls, value):
        """Validate MIDI control value is in valid range"""
        return max(0, min(127, value))
