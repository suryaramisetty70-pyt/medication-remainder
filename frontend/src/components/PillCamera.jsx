import React, { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, CheckCircle, AlertTriangle, RefreshCw, X } from 'lucide-react';

export default function PillCamera({ medicationName, onClose, onVerified }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [hasCamera, setHasCamera] = useState(true);
  const [streamActive, setStreamActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Start Camera
  const startCamera = async () => {
    setErrorMessage("");
    setAiResult(null);
    setCapturedImage(null);
    setFileToUpload(null);
    
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Prefer back camera on phones
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStreamActive(true);
      setHasCamera(true);
    } catch (err) {
      console.warn("Camera access failed, falling back to file upload:", err);
      setHasCamera(false);
      setStreamActive(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Capture Photo
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg');
      setCapturedImage(dataUrl);
      
      // Stop the video stream to conserve power
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        setStreamActive(false);
      }
    }
  };

  // Handle File Input Fallback
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileToUpload(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Convert Data URL to Blob for Form Submission
  const dataURLtoBlob = (dataurl) => {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
  };

  // Send Image to Backend for Verification
  const verifyImage = async () => {
    if (!capturedImage) return;
    setLoading(true);
    setErrorMessage("");
    setAiResult(null);

    try {
      const formData = new FormData();
      formData.append("medication_name", medicationName);
      
      if (fileToUpload) {
        formData.append("image", fileToUpload);
      } else {
        const imageBlob = dataURLtoBlob(capturedImage);
        formData.append("image", imageBlob, "captured_pill.jpg");
      }

      const response = await fetch("http://127.0.0.1:8000/api/verify-pill", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Pill verification API request failed.");
      }

      const data = await response.json();
      setAiResult(data);
    } catch (err) {
      setErrorMessage("Could not connect to the AI Verification server. Logging without AI check.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Submit Result
  const handleLogConfirmation = (isVerifiedSuccess) => {
    onVerified(
      isVerifiedSuccess ? "taken" : "taken", 
      true, 
      aiResult?.message || "Manually verified by patient.",
      capturedImage
    );
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="card-title" style={{ marginBottom: 0 }}>
            <Camera size={20} className="logo-icon" /> AI Pill Scanner
          </h3>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className="modal-body">
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Verify you are taking: <strong>{medicationName}</strong>
          </p>

          {/* Error Message */}
          {errorMessage && (
            <div style={{
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              padding: '0.75rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Camera View / Captured Image Area */}
          <div className="camera-box">
            {capturedImage ? (
              <img src={capturedImage} alt="Captured Pill" className="camera-preview" />
            ) : hasCamera ? (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="camera-video"></video>
                <div className="camera-overlay-text">Center the pill in the frame and take a photo.</div>
              </>
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                padding: '2rem',
                textAlign: 'center'
              }}>
                <ImageIcon size={48} style={{ color: 'var(--text-muted)' }} />
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Webcam access unavailable or permission denied. Please upload a photo.
                </p>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  id="file-upload-input"
                  style={{ display: 'none' }}
                />
                <label 
                  htmlFor="file-upload-input" 
                  className="btn btn-secondary" 
                  style={{ width: 'auto', display: 'inline-flex' }}
                >
                  Choose Photo
                </label>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Action Row */}
          {!capturedImage && hasCamera && streamActive && (
            <button className="btn btn-primary" onClick={capturePhoto}>
              <Camera size={18} /> Capture Photo
            </button>
          )}

          {capturedImage && !aiResult && !loading && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={startCamera}>
                <RefreshCw size={18} /> Retake
              </button>
              <button className="btn btn-success" onClick={verifyImage}>
                Verify with AI
              </button>
            </div>
          )}

          {/* AI Loader */}
          {loading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem 1rem',
              gap: '0.75rem'
            }}>
              <RefreshCw size={24} className="logo-icon" style={{ animation: 'spin 1.5s linear infinite' }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>AI is checking the medication details...</p>
            </div>
          )}

          {/* AI Analysis Result */}
          {aiResult && (
            <div style={{
              marginTop: '1.25rem',
              padding: '1.25rem',
              borderRadius: '12px',
              background: aiResult.verified ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
              border: `1px solid ${aiResult.verified ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: aiResult.verified ? 'var(--color-success)' : 'var(--color-danger)',
                fontWeight: 600,
                fontSize: '1.05rem',
                marginBottom: '0.5rem'
              }}>
                {aiResult.verified ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                <span>{aiResult.verified ? "AI Ingestion Verified" : "AI Verification Warning"}</span>
              </div>
              
              <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                <strong>AI Observations:</strong> {aiResult.description}
              </p>
              
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                <strong>Feedback:</strong> {aiResult.message}
              </p>

              <div style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>Match Confidence:</span>
                <span style={{ fontWeight: 600 }}>{Math.round(aiResult.confidence * 100)}%</span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {aiResult.verified ? (
                  <button className="btn btn-success" onClick={() => handleLogConfirmation(true)}>
                    Confirm & Ingest
                  </button>
                ) : (
                  <>
                    <button className="btn btn-secondary" onClick={startCamera}>
                      Try Again
                    </button>
                    <button className="btn btn-danger" onClick={() => handleLogConfirmation(false)}>
                      Log Anyway (Force)
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} style={{ width: 'auto' }}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => handleLogConfirmation(false)} style={{ width: 'auto' }}>
              Log Manually
            </button>
          </div>
        )}
      </div>
      
      {/* Dynamic inline styles for rotating animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
