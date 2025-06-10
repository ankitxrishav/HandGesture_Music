#!/usr/bin/env python3
"""
Motion-Controlled Music Creation Tool
Main application entry point
"""

import sys
import cv2
import threading
import time
from gui_interface import MusicCreatorGUI
from hand_tracker import HandTracker
from gesture_recognizer import GestureRecognizer
from midi_generator import MIDIGenerator
from audio_engine import AudioEngine
from config import Config

class MotionMusicApp:
    def __init__(self):
        self.config = Config()
        self.running = False
        self.camera = None
        
        # Initialize components
        self.hand_tracker = HandTracker()
        self.gesture_recognizer = GestureRecognizer()
        self.midi_generator = MIDIGenerator()
        self.audio_engine = AudioEngine()
        
        # Initialize GUI
        self.gui = MusicCreatorGUI(self)
        
    def start_camera(self):
        """Initialize and start camera capture"""
        try:
            self.camera = cv2.VideoCapture(0)
            if not self.camera.isOpened():
                raise Exception("Cannot access camera")
            
            # Set camera properties for better performance
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.CAMERA_WIDTH)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.CAMERA_HEIGHT)
            self.camera.set(cv2.CAP_PROP_FPS, self.config.CAMERA_FPS)
            
            return True
        except Exception as e:
            print(f"Camera initialization error: {e}")
            return False
    
    def stop_camera(self):
        """Stop camera capture and release resources"""
        if self.camera:
            self.camera.release()
            self.camera = None
    
    def start_tracking(self):
        """Start the hand tracking and music generation process"""
        if not self.start_camera():
            self.gui.show_error("Failed to initialize camera")
            return
        
        self.running = True
        self.tracking_thread = threading.Thread(target=self._tracking_loop, daemon=True)
        self.tracking_thread.start()
        
        # Start audio engine
        self.audio_engine.start()
        
        print("Motion tracking started")
    
    def stop_tracking(self):
        """Stop the tracking process"""
        self.running = False
        self.stop_camera()
        self.audio_engine.stop()
        print("Motion tracking stopped")
    
    def _tracking_loop(self):
        """Main tracking loop - runs in separate thread"""
        last_frame_time = time.time()
        
        while self.running and self.camera:
            try:
                ret, frame = self.camera.read()
                if not ret:
                    continue
                
                # Flip frame horizontally for mirror effect
                frame = cv2.flip(frame, 1)
                
                # Track hands
                hand_landmarks = self.hand_tracker.process_frame(frame)
                
                if hand_landmarks:
                    # Recognize gestures and generate music
                    for hand_data in hand_landmarks:
                        gestures = self.gesture_recognizer.analyze_hand(hand_data)
                        
                        # Generate MIDI based on gestures
                        midi_events = self.midi_generator.process_gestures(gestures)
                        
                        # Send to audio engine
                        for event in midi_events:
                            self.audio_engine.play_note(event)
                
                # Draw hand landmarks on frame
                annotated_frame = self.hand_tracker.draw_landmarks(frame)
                
                # Update GUI with frame
                self.gui.update_video_frame(annotated_frame)
                
                # Control frame rate
                current_time = time.time()
                frame_time = current_time - last_frame_time
                target_frame_time = 1.0 / self.config.CAMERA_FPS
                
                if frame_time < target_frame_time:
                    time.sleep(target_frame_time - frame_time)
                
                last_frame_time = current_time
                
            except Exception as e:
                print(f"Tracking loop error: {e}")
                continue
    
    def run(self):
        """Run the application"""
        try:
            self.gui.run()
        except KeyboardInterrupt:
            print("\nShutting down...")
        finally:
            self.stop_tracking()
            cv2.destroyAllWindows()

if __name__ == "__main__":
    app = MotionMusicApp()
    app.run()
