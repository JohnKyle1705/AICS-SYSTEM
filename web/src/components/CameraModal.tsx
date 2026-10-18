'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Camera, X, RotateCcw, FlipHorizontal2, ZoomIn, AlertCircle,
  Upload, CheckCircle2, Loader2
} from 'lucide-react'

interface CameraModalProps {
  isOpen: boolean
  label: string
  onCapture: (file: File) => void
  onClose: () => void
}

type CameraState =
  | 'requesting'
  | 'preview'
  | 'captured'
  | 'error'
  | 'unsupported'

export default function CameraModal({ isOpen, label, onCapture, onClose }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [cameraState, setCameraState] = useState<CameraState>('requesting')
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const [isMirrored, setIsMirrored] = useState(false)

  // ── Start camera stream ────────────────────────────────────────
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraState('requesting')
    setErrorMsg('')

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported')
      return
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          setCameraState('preview')
        }
      }

      // Detect if there are multiple cameras
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices.filter(d => d.kind === 'videoinput')
      setHasMultipleCameras(videoInputs.length > 1)
    } catch (err: any) {
      console.error('Camera error:', err)
      const name = err?.name ?? ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setErrorMsg('Camera permission was denied. Please allow camera access in your browser settings, or use the file upload fallback below.')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setErrorMsg('No camera was found on this device.')
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setErrorMsg('Camera is in use by another application. Please close it and try again.')
      } else if (name === 'OverconstrainedError') {
        // Try without facingMode constraint
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play()
              setCameraState('preview')
            }
          }
          return
        } catch {
          setErrorMsg('Could not start the camera with the requested settings.')
        }
      } else {
        setErrorMsg(`Camera error: ${err?.message ?? 'Unknown error'}`)
      }
      setCameraState('error')
    }
  }, [])

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // ── Open/close lifecycle ───────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setCapturedUrl(null)
      setCapturedFile(null)
      setIsMirrored(false)
      startCamera(facingMode)
    } else {
      stopStream()
    }
    return () => {
      stopStream()
    }
  }, [isOpen, facingMode, startCamera, stopStream])

  // ── Capture photo from video ───────────────────────────────────
  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (isMirrored) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(blob => {
      if (!blob) return
      const timestamp = Date.now()
      const file = new File([blob], `camera_capture_${timestamp}.jpg`, { type: 'image/jpeg' })
      const url = URL.createObjectURL(blob)
      setCapturedFile(file)
      setCapturedUrl(url)
      setCameraState('captured')
      stopStream()
    }, 'image/jpeg', 0.92)
  }

  // ── Switch camera ──────────────────────────────────────────────
  const switchCamera = () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(newFacing)
    setIsMirrored(newFacing === 'user')
    startCamera(newFacing)
  }

  // ── Retake ─────────────────────────────────────────────────────
  const retake = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    setCapturedUrl(null)
    setCapturedFile(null)
    startCamera(facingMode)
  }

  // ── Confirm captured photo ─────────────────────────────────────
  const confirmCapture = () => {
    if (capturedFile) {
      onCapture(capturedFile)
      if (capturedUrl) URL.revokeObjectURL(capturedUrl)
      onClose()
    }
  }

  // ── File fallback ──────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setCapturedFile(file)
    setCapturedUrl(url)
    setCameraState('captured')
    stopStream()
  }

  // ── Close with cleanup ─────────────────────────────────────────
  const handleClose = () => {
    stopStream()
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    setCapturedUrl(null)
    setCapturedFile(null)
    setCameraState('requesting')
    onClose()
  }

  // ── Keyboard close ─────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    if (isOpen) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        className="relative w-full max-w-lg bg-[var(--color-surface)] rounded-2xl overflow-hidden shadow-2xl"
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Camera size={16} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-secondary)] font-medium">Capture Photo</p>
              <h2 className="font-bold text-sm text-[var(--color-text)]">{label}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
            aria-label="Close camera"
          >
            <X size={18} />
          </button>
        </div>

        {/* Camera viewport */}
        <div className="relative bg-black flex-1" style={{ minHeight: 0 }}>

          {/* Loading spinner */}
          {cameraState === 'requesting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <Loader2 size={36} className="animate-spin text-blue-400" />
              <p className="text-sm font-medium text-slate-300">Requesting camera access…</p>
            </div>
          )}

          {/* Live video preview */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full object-cover"
            style={{
              display: cameraState === 'preview' ? 'block' : 'none',
              transform: isMirrored ? 'scaleX(-1)' : 'none',
              maxHeight: '55vh',
            }}
          />

          {/* Captured photo preview */}
          {cameraState === 'captured' && capturedUrl && (
            <div className="flex items-center justify-center bg-black" style={{ maxHeight: '55vh' }}>
              <img
                src={capturedUrl}
                alt="Captured"
                className="w-full object-contain"
                style={{ maxHeight: '55vh' }}
              />
            </div>
          )}

          {/* Error state */}
          {(cameraState === 'error' || cameraState === 'unsupported') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center">
                <AlertCircle size={32} className="text-red-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm mb-1">Camera Unavailable</p>
                <p className="text-slate-400 text-xs leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Grid overlay (only in preview) */}
          {cameraState === 'preview' && (
            <div className="absolute inset-0 pointer-events-none">
              <svg width="100%" height="100%" className="opacity-20">
                <line x1="33%" y1="0" x2="33%" y2="100%" stroke="white" strokeWidth="1" />
                <line x1="67%" y1="0" x2="67%" y2="100%" stroke="white" strokeWidth="1" />
                <line x1="0" y1="33%" x2="100%" y2="33%" stroke="white" strokeWidth="1" />
                <line x1="0" y1="67%" x2="100%" y2="67%" stroke="white" strokeWidth="1" />
              </svg>
            </div>
          )}

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Controls */}
        <div className="px-5 py-4 space-y-3 border-t border-[var(--color-border)]">

          {/* Preview controls */}
          {cameraState === 'preview' && (
            <div className="flex items-center justify-between gap-3">
              {/* Mirror toggle */}
              <button
                type="button"
                onClick={() => setIsMirrored(m => !m)}
                title="Mirror camera"
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-blue-500 transition-colors"
              >
                <FlipHorizontal2 size={18} />
              </button>

              {/* Capture shutter */}
              <button
                type="button"
                onClick={capturePhoto}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-600/30"
              >
                <Camera size={18} />
                Capture Photo
              </button>

              {/* Switch camera */}
              {hasMultipleCameras ? (
                <button
                  type="button"
                  onClick={switchCamera}
                  title="Switch camera"
                  className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-blue-500 transition-colors"
                >
                  <RotateCcw size={18} />
                </button>
              ) : (
                <div className="w-10" />
              )}
            </div>
          )}

          {/* Captured controls */}
          {cameraState === 'captured' && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={retake}
                className="flex-1 py-3 rounded-xl border border-[var(--color-border)] text-[var(--color-text)] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <RotateCcw size={16} />
                Retake
              </button>
              <button
                type="button"
                onClick={confirmCapture}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/20"
              >
                <CheckCircle2 size={16} />
                Use Photo
              </button>
            </div>
          )}

          {/* Error/unsupported: retry + file fallback */}
          {(cameraState === 'error' || cameraState === 'unsupported') && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw size={16} />
                Try Again
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <Upload size={14} />
                Upload from Gallery Instead
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* Requesting: offer file fallback too */}
          {cameraState === 'requesting' && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              <Upload size={14} />
              Upload from Gallery Instead
            </button>
          )}
          {cameraState === 'requesting' && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}
