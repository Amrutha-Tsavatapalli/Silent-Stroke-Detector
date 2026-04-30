"""Quick test script to verify all components are working."""
import sys

def test_imports():
    """Test that all required packages can be imported."""
    print("Testing imports...")
    
    try:
        import cv2
        print("✅ OpenCV imported successfully")
    except ImportError as e:
        print(f"❌ OpenCV import failed: {e}")
        return False
    
    try:
        import mediapipe as mp
        print("✅ MediaPipe imported successfully")
    except ImportError as e:
        print(f"❌ MediaPipe import failed: {e}")
        return False
    
    try:
        import librosa
        print("✅ Librosa imported successfully")
    except ImportError as e:
        print(f"❌ Librosa import failed: {e}")
        return False
    
    try:
        import streamlit as st
        print("✅ Streamlit imported successfully")
    except ImportError as e:
        print(f"❌ Streamlit import failed: {e}")
        return False
    
    try:
        import numpy as np
        print("✅ NumPy imported successfully")
    except ImportError as e:
        print(f"❌ NumPy import failed: {e}")
        return False
    
    try:
        import sounddevice as sd
        print("✅ sounddevice imported successfully")
    except ImportError as e:
        print(f"⚠️  sounddevice import failed (optional): {e}")
    
    return True


def test_camera():
    """Test camera access."""
    print("\nTesting camera access...")
    
    try:
        import cv2
        cap = cv2.VideoCapture(0)
        
        if not cap.isOpened():
            print("❌ Camera not accessible")
            return False
        
        ret, frame = cap.read()
        cap.release()
        
        if ret and frame is not None:
            print(f"✅ Camera working - Frame shape: {frame.shape}")
            return True
        else:
            print("❌ Camera opened but couldn't read frame")
            return False
            
    except Exception as e:
        print(f"❌ Camera test failed: {e}")
        return False


def test_mediapipe():
    """Test MediaPipe face mesh."""
    print("\nTesting MediaPipe face detection...")
    
    try:
        import cv2
        import mediapipe as mp
        import numpy as np
        
        # Create a dummy face image
        dummy_image = np.zeros((480, 640, 3), dtype=np.uint8)
        
        face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
        )
        
        result = face_mesh.process(cv2.cvtColor(dummy_image, cv2.COLOR_BGR2RGB))
        print("✅ MediaPipe face mesh initialized successfully")
        
        face_mesh.close()
        return True
        
    except Exception as e:
        print(f"❌ MediaPipe test failed: {e}")
        return False


def test_audio():
    """Test audio recording capability."""
    print("\nTesting audio recording...")
    
    try:
        import sounddevice as sd
        
        devices = sd.query_devices()
        print(f"✅ Found {len(devices)} audio devices")
        
        # Find default input device
        default_input = sd.query_devices(kind='input')
        print(f"✅ Default input device: {default_input['name']}")
        
        return True
        
    except Exception as e:
        print(f"⚠️  Audio test failed (optional): {e}")
        return True  # Audio is optional


def test_modules():
    """Test custom modules."""
    print("\nTesting custom modules...")
    
    try:
        from src.stroke_detector.vision.asymmetry import FaceAsymmetryAnalyzer
        print("✅ FaceAsymmetryAnalyzer imported")
        
        from src.stroke_detector.audio.slur_features import VoiceSlurAnalyzer
        print("✅ VoiceSlurAnalyzer imported")
        
        from src.stroke_detector.pipelines.runtime import StrokeDetectionRuntime
        print("✅ StrokeDetectionRuntime imported")
        
        from src.stroke_detector.config import AppConfig
        print("✅ AppConfig imported")
        
        return True
        
    except Exception as e:
        print(f"❌ Module test failed: {e}")
        return False


def test_pipeline():
    """Test the full pipeline with dummy data."""
    print("\nTesting full pipeline...")
    
    try:
        import numpy as np
        from src.stroke_detector.config import AppConfig
        from src.stroke_detector.pipelines.runtime import StrokeDetectionRuntime
        
        config = AppConfig()
        runtime = StrokeDetectionRuntime(config)
        
        # Create dummy data
        dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        dummy_audio = np.random.randn(16000 * 3).astype(np.float32) * 0.1
        
        result = runtime.run(
            frame=dummy_frame,
            audio_waveform=dummy_audio,
            sample_rate=16000,
            patient_name="Test Patient",
            location="Test Location",
            scenario_label="test",
        )
        
        print(f"✅ Pipeline executed successfully")
        print(f"   - Overall risk: {result.fusion.risk_score:.2f}")
        print(f"   - Face risk: {result.face.risk_score:.2f}")
        print(f"   - Voice risk: {result.voice.risk_score:.2f}")
        
        return True
        
    except Exception as e:
        print(f"❌ Pipeline test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("Silent Stroke Detector - System Test")
    print("=" * 60)
    print()
    
    results = []
    
    results.append(("Imports", test_imports()))
    results.append(("Camera", test_camera()))
    results.append(("MediaPipe", test_mediapipe()))
    results.append(("Audio", test_audio()))
    results.append(("Modules", test_modules()))
    results.append(("Pipeline", test_pipeline()))
    
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{name:20s} {status}")
    
    all_passed = all(result[1] for result in results)
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ All tests passed! System is ready.")
        print("\nYou can now run:")
        print("  streamlit run app_live.py")
    else:
        print("❌ Some tests failed. Please fix the issues above.")
        print("\nCommon fixes:")
        print("  - Install missing packages: pip install -r requirements.txt")
        print("  - Check camera permissions")
        print("  - Restart your terminal/IDE")
    print("=" * 60)
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
