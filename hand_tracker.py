"""
Hand tracking module using MediaPipe
Handles real-time hand detection and landmark extraction
"""

import cv2
import mediapipe as mp
import numpy as np
from typing import List, Optional, Tuple

class HandTracker:
    def __init__(self):
        # Initialize MediaPipe hands
        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles
        
        # Configure hand detection
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        
        self.hand_landmarks = []
        self.frame_height = 0
        self.frame_width = 0
    
    def process_frame(self, frame: np.ndarray) -> List[dict]:
        """
        Process a single frame and extract hand landmarks
        
        Args:
            frame: Input BGR frame from camera
            
        Returns:
            List of hand data dictionaries containing landmarks and metadata
        """
        self.frame_height, self.frame_width = frame.shape[:2]
        
        # Convert BGR to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Process frame
        results = self.hands.process(rgb_frame)
        
        hand_data_list = []
        
        if results.multi_hand_landmarks:
            for idx, hand_landmarks in enumerate(results.multi_hand_landmarks):
                # Get hand classification (Left/Right)
                handedness = "Unknown"
                if results.multi_handedness:
                    handedness = results.multi_handedness[idx].classification[0].label
                
                # Extract landmark coordinates
                landmarks = self._extract_landmarks(hand_landmarks)
                
                # Calculate hand metrics
                hand_data = {
                    'landmarks': landmarks,
                    'handedness': handedness,
                    'center': self._calculate_center(landmarks),
                    'bounding_box': self._calculate_bounding_box(landmarks),
                    'finger_positions': self._get_finger_positions(landmarks),
                    'gesture_features': self._extract_gesture_features(landmarks)
                }
                
                hand_data_list.append(hand_data)
        
        self.hand_landmarks = hand_data_list
        return hand_data_list
    
    def _extract_landmarks(self, hand_landmarks) -> List[Tuple[float, float]]:
        """Extract normalized landmark coordinates"""
        landmarks = []
        for landmark in hand_landmarks.landmark:
            x = landmark.x * self.frame_width
            y = landmark.y * self.frame_height
            landmarks.append((x, y))
        return landmarks
    
    def _calculate_center(self, landmarks: List[Tuple[float, float]]) -> Tuple[float, float]:
        """Calculate center point of hand"""
        if not landmarks:
            return (0, 0)
        
        x_coords = [point[0] for point in landmarks]
        y_coords = [point[1] for point in landmarks]
        
        center_x = sum(x_coords) / len(x_coords)
        center_y = sum(y_coords) / len(y_coords)
        
        return (center_x, center_y)
    
    def _calculate_bounding_box(self, landmarks: List[Tuple[float, float]]) -> Tuple[int, int, int, int]:
        """Calculate bounding box around hand"""
        if not landmarks:
            return (0, 0, 0, 0)
        
        x_coords = [point[0] for point in landmarks]
        y_coords = [point[1] for point in landmarks]
        
        min_x, max_x = int(min(x_coords)), int(max(x_coords))
        min_y, max_y = int(min(y_coords)), int(max(y_coords))
        
        return (min_x, min_y, max_x - min_x, max_y - min_y)
    
    def _get_finger_positions(self, landmarks: List[Tuple[float, float]]) -> dict:
        """Get positions of finger tips and important points"""
        if len(landmarks) < 21:
            return {}
        
        # MediaPipe hand landmark indices
        finger_tips = {
            'thumb': landmarks[4],
            'index': landmarks[8],
            'middle': landmarks[12],
            'ring': landmarks[16],
            'pinky': landmarks[20]
        }
        
        finger_mcp = {
            'thumb': landmarks[2],
            'index': landmarks[5],
            'middle': landmarks[9],
            'ring': landmarks[13],
            'pinky': landmarks[17]
        }
        
        return {
            'tips': finger_tips,
            'mcp': finger_mcp,
            'wrist': landmarks[0]
        }
    
    def _extract_gesture_features(self, landmarks: List[Tuple[float, float]]) -> dict:
        """Extract features for gesture recognition"""
        if len(landmarks) < 21:
            return {}
        
        # Calculate finger extension states
        finger_states = self._calculate_finger_states(landmarks)
        
        # Calculate hand orientation
        wrist = landmarks[0]
        middle_mcp = landmarks[9]
        hand_vector = (middle_mcp[0] - wrist[0], middle_mcp[1] - wrist[1])
        hand_angle = np.arctan2(hand_vector[1], hand_vector[0])
        
        # Calculate hand size (distance from wrist to middle finger tip)
        middle_tip = landmarks[12]
        hand_size = np.sqrt((middle_tip[0] - wrist[0])**2 + (middle_tip[1] - wrist[1])**2)
        
        return {
            'finger_states': finger_states,
            'hand_angle': hand_angle,
            'hand_size': hand_size,
            'palm_center': landmarks[9]  # Middle finger MCP as palm center
        }
    
    def _calculate_finger_states(self, landmarks: List[Tuple[float, float]]) -> dict:
        """Determine if fingers are extended or folded"""
        finger_states = {}
        
        # Finger tip and PIP joint indices
        fingers = {
            'thumb': (4, 3),
            'index': (8, 6),
            'middle': (12, 10),
            'ring': (16, 14),
            'pinky': (20, 18)
        }
        
        for finger_name, (tip_idx, pip_idx) in fingers.items():
            tip = landmarks[tip_idx]
            pip = landmarks[pip_idx]
            
            # For thumb, use different logic (horizontal movement)
            if finger_name == 'thumb':
                mcp = landmarks[2]
                # Thumb is extended if tip is further from palm than MCP
                tip_distance = abs(tip[0] - landmarks[0][0])
                mcp_distance = abs(mcp[0] - landmarks[0][0])
                finger_states[finger_name] = tip_distance > mcp_distance
            else:
                # For other fingers, check if tip is above PIP joint
                finger_states[finger_name] = tip[1] < pip[1]
        
        return finger_states
    
    def draw_landmarks(self, frame: np.ndarray) -> np.ndarray:
        """Draw hand landmarks on frame"""
        annotated_frame = frame.copy()
        
        if self.hand_landmarks:
            for hand_data in self.hand_landmarks:
                landmarks = hand_data['landmarks']
                
                # Draw landmarks
                for point in landmarks:
                    cv2.circle(annotated_frame, (int(point[0]), int(point[1])), 3, (0, 255, 0), -1)
                
                # Draw connections between landmarks
                self._draw_connections(annotated_frame, landmarks)
                
                # Draw hand center
                center = hand_data['center']
                cv2.circle(annotated_frame, (int(center[0]), int(center[1])), 8, (255, 0, 0), -1)
                
                # Draw bounding box
                bbox = hand_data['bounding_box']
                cv2.rectangle(annotated_frame, 
                            (bbox[0], bbox[1]), 
                            (bbox[0] + bbox[2], bbox[1] + bbox[3]), 
                            (255, 255, 0), 2)
                
                # Display handedness
                cv2.putText(annotated_frame, hand_data['handedness'], 
                          (bbox[0], bbox[1] - 10), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        return annotated_frame
    
    def _draw_connections(self, frame: np.ndarray, landmarks: List[Tuple[float, float]]):
        """Draw connections between hand landmarks"""
        # Define connections between landmarks
        connections = [
            # Thumb
            (0, 1), (1, 2), (2, 3), (3, 4),
            # Index finger
            (0, 5), (5, 6), (6, 7), (7, 8),
            # Middle finger
            (0, 9), (9, 10), (10, 11), (11, 12),
            # Ring finger
            (0, 13), (13, 14), (14, 15), (15, 16),
            # Pinky
            (0, 17), (17, 18), (18, 19), (19, 20),
            # Palm
            (5, 9), (9, 13), (13, 17)
        ]
        
        for start_idx, end_idx in connections:
            if start_idx < len(landmarks) and end_idx < len(landmarks):
                start_point = (int(landmarks[start_idx][0]), int(landmarks[start_idx][1]))
                end_point = (int(landmarks[end_idx][0]), int(landmarks[end_idx][1]))
                cv2.line(frame, start_point, end_point, (0, 255, 255), 2)
