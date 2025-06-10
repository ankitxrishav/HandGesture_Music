"""
GUI interface module using Tkinter
Provides the main user interface for the motion music application
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import cv2
from PIL import Image, ImageTk
import threading
import time

class MusicCreatorGUI:
    def __init__(self, app):
        self.app = app
        self.root = tk.Tk()
        self.root.title("Motion-Controlled Music Creator")
        self.root.geometry("1000x700")
        
        # Video display variables
        self.video_label = None
        self.current_frame = None
        
        # Control variables
        self.is_tracking = False
        self.volume_var = tk.DoubleVar(value=0.5)
        self.status_var = tk.StringVar(value="Ready")
        
        # Initialize GUI components
        self._create_gui()
        
        # Bind window close event
        self.root.protocol("WM_DELETE_WINDOW", self._on_closing)
        
    def _create_gui(self):
        """Create the main GUI layout"""
        # Main container
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Configure grid weights
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(1, weight=1)
        
        # Create GUI sections
        self._create_control_panel(main_frame)
        self._create_video_display(main_frame)
        self._create_status_panel(main_frame)
        self._create_info_panel(main_frame)
        
    def _create_control_panel(self, parent):
        """Create control panel with buttons and settings"""
        control_frame = ttk.LabelFrame(parent, text="Controls", padding="10")
        control_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # Start/Stop button
        self.start_button = ttk.Button(
            control_frame, 
            text="Start Tracking", 
            command=self._toggle_tracking
        )
        self.start_button.grid(row=0, column=0, padx=(0, 10))
        
        # Volume control
        ttk.Label(control_frame, text="Volume:").grid(row=0, column=1, padx=(10, 5))
        volume_scale = ttk.Scale(
            control_frame, 
            from_=0.0, 
            to=1.0, 
            variable=self.volume_var,
            command=self._on_volume_change,
            length=200
        )
        volume_scale.grid(row=0, column=2, padx=(0, 10))
        
        # Volume label
        self.volume_label = ttk.Label(control_frame, text="50%")
        self.volume_label.grid(row=0, column=3, padx=(5, 20))
        
        # Save MIDI button
        save_button = ttk.Button(
            control_frame, 
            text="Save MIDI", 
            command=self._save_midi
        )
        save_button.grid(row=0, column=4, padx=(0, 10))
        
        # Settings button
        settings_button = ttk.Button(
            control_frame, 
            text="Settings", 
            command=self._show_settings
        )
        settings_button.grid(row=0, column=5)
        
    def _create_video_display(self, parent):
        """Create video display area"""
        video_frame = ttk.LabelFrame(parent, text="Camera Feed", padding="10")
        video_frame.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(0, 10))
        video_frame.columnconfigure(0, weight=1)
        video_frame.rowconfigure(0, weight=1)
        
        # Video display label
        self.video_label = ttk.Label(video_frame, text="Camera feed will appear here")
        self.video_label.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Configure minimum size
        video_frame.configure(width=640, height=480)
        
    def _create_status_panel(self, parent):
        """Create status and information panel"""
        status_frame = ttk.LabelFrame(parent, text="Status", padding="10")
        status_frame.grid(row=1, column=1, sticky=(tk.W, tk.E, tk.N, tk.S))
        status_frame.columnconfigure(0, weight=1)
        
        # Status text
        status_label = ttk.Label(status_frame, textvariable=self.status_var)
        status_label.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # Performance metrics
        self.metrics_text = tk.Text(status_frame, height=15, width=30)
        self.metrics_text.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Scrollbar for metrics
        metrics_scrollbar = ttk.Scrollbar(status_frame, orient="vertical", command=self.metrics_text.yview)
        metrics_scrollbar.grid(row=1, column=1, sticky=(tk.N, tk.S))
        self.metrics_text.configure(yscrollcommand=metrics_scrollbar.set)
        
    def _create_info_panel(self, parent):
        """Create information panel at the bottom"""
        info_frame = ttk.LabelFrame(parent, text="Instructions", padding="10")
        info_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(10, 0))
        
        instructions = """
Instructions:
• Position your hand in front of the camera
• Extended fingers trigger notes based on screen position
• Move your hand horizontally for pitch bend
• Move your hand vertically for volume control
• Make a fist to stop all notes
• Open hand to sustain notes
• Point (index finger only) for single notes
• Peace sign (index + middle) for chord mode
        """
        
        info_label = ttk.Label(info_frame, text=instructions, justify=tk.LEFT)
        info_label.grid(row=0, column=0, sticky=(tk.W, tk.E))
        
    def _toggle_tracking(self):
        """Toggle hand tracking on/off"""
        if not self.is_tracking:
            self._start_tracking()
        else:
            self._stop_tracking()
    
    def _start_tracking(self):
        """Start hand tracking"""
        try:
            self.app.start_tracking()
            self.is_tracking = True
            self.start_button.configure(text="Stop Tracking")
            self.status_var.set("Tracking active")
            self._log_message("Hand tracking started")
        except Exception as e:
            self.show_error(f"Failed to start tracking: {e}")
    
    def _stop_tracking(self):
        """Stop hand tracking"""
        self.app.stop_tracking()
        self.is_tracking = False
        self.start_button.configure(text="Start Tracking")
        self.status_var.set("Tracking stopped")
        self._log_message("Hand tracking stopped")
        
        # Clear video display
        self.video_label.configure(image="", text="Camera feed will appear here")
    
    def _on_volume_change(self, value):
        """Handle volume slider change"""
        volume = float(value)
        self.app.audio_engine.set_volume(volume)
        percentage = int(volume * 100)
        self.volume_label.configure(text=f"{percentage}%")
    
    def _save_midi(self):
        """Save MIDI file"""
        try:
            file_path = filedialog.asksaveasfilename(
                defaultextension=".mid",
                filetypes=[("MIDI files", "*.mid"), ("All files", "*.*")]
            )
            
            if file_path:
                self.app.midi_generator.save_midi_file()
                
                # Copy to user-specified location
                import shutil
                shutil.copy2(self.app.midi_generator.get_midi_file_path(), file_path)
                
                self._log_message(f"MIDI saved to: {file_path}")
                messagebox.showinfo("Success", f"MIDI file saved to:\n{file_path}")
        except Exception as e:
            self.show_error(f"Failed to save MIDI: {e}")
    
    def _show_settings(self):
        """Show settings dialog"""
        settings_window = tk.Toplevel(self.root)
        settings_window.title("Settings")
        settings_window.geometry("400x300")
        settings_window.transient(self.root)
        settings_window.grab_set()
        
        # Settings content
        ttk.Label(settings_window, text="Application Settings", font=("Arial", 12, "bold")).pack(pady=10)
        
        # Camera settings
        camera_frame = ttk.LabelFrame(settings_window, text="Camera Settings", padding="10")
        camera_frame.pack(fill="x", padx=10, pady=5)
        
        ttk.Label(camera_frame, text="Resolution: 640x480").pack(anchor="w")
        ttk.Label(camera_frame, text="FPS: 30").pack(anchor="w")
        
        # MIDI settings
        midi_frame = ttk.LabelFrame(settings_window, text="MIDI Settings", padding="10")
        midi_frame.pack(fill="x", padx=10, pady=5)
        
        ttk.Label(midi_frame, text="Default Velocity: 64").pack(anchor="w")
        ttk.Label(midi_frame, text="Channel: 0").pack(anchor="w")
        
        # Audio settings
        audio_frame = ttk.LabelFrame(settings_window, text="Audio Settings", padding="10")
        audio_frame.pack(fill="x", padx=10, pady=5)
        
        ttk.Label(audio_frame, text="Sample Rate: 44100 Hz").pack(anchor="w")
        ttk.Label(audio_frame, text="Channels: Stereo").pack(anchor="w")
        
        # Close button
        close_button = ttk.Button(settings_window, text="Close", command=settings_window.destroy)
        close_button.pack(pady=20)
    
    def update_video_frame(self, frame):
        """Update video display with new frame"""
        try:
            # Resize frame for display
            display_height = 400
            aspect_ratio = frame.shape[1] / frame.shape[0]
            display_width = int(display_height * aspect_ratio)
            
            resized_frame = cv2.resize(frame, (display_width, display_height))
            
            # Convert from BGR to RGB
            rgb_frame = cv2.cvtColor(resized_frame, cv2.COLOR_BGR2RGB)
            
            # Convert to PIL Image
            pil_image = Image.fromarray(rgb_frame)
            
            # Convert to Tkinter format
            tk_image = ImageTk.PhotoImage(pil_image)
            
            # Update label
            self.video_label.configure(image=tk_image, text="")
            self.video_label.image = tk_image  # Keep reference
            
        except Exception as e:
            print(f"Error updating video frame: {e}")
    
    def _log_message(self, message):
        """Add message to metrics text area"""
        timestamp = time.strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] {message}\n"
        
        # Add to metrics text
        self.metrics_text.insert(tk.END, log_entry)
        self.metrics_text.see(tk.END)
        
        # Limit text length
        if self.metrics_text.index(tk.END).split('.')[0] > '100':
            self.metrics_text.delete('1.0', '10.0')
    
    def show_error(self, message):
        """Show error message dialog"""
        messagebox.showerror("Error", message)
        self._log_message(f"ERROR: {message}")
    
    def _on_closing(self):
        """Handle window closing"""
        if self.is_tracking:
            self._stop_tracking()
        
        self.root.quit()
        self.root.destroy()
    
    def run(self):
        """Start the GUI main loop"""
        self.root.mainloop()
    
    def update_status(self, status_text):
        """Update status display"""
        self.status_var.set(status_text)
        
    def update_metrics(self, metrics_dict):
        """Update performance metrics display"""
        current_time = time.strftime("%H:%M:%S")
        
        # Format metrics
        metrics_text = f"[{current_time}] Performance Metrics:\n"
        for key, value in metrics_dict.items():
            metrics_text += f"  {key}: {value}\n"
        
        # Add to display
        self.metrics_text.insert(tk.END, metrics_text)
        self.metrics_text.see(tk.END)
