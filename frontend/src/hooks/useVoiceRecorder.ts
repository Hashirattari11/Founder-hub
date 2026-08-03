import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_SECONDS = 60

interface VoiceRecorder {
  recording: boolean
  duration: number
  blob: Blob | null
  error: string | null
  start: () => Promise<void>
  stop: () => void
  cancel: () => void
  formatDuration: (seconds: number) => string
}

/** Hold-to-record audio capture using the MediaRecorder API. */
export function useVoiceRecorder(): VoiceRecorder {
  const [recording, setRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setDuration(0)
    chunksRef.current = []
  }, [])

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }, [])

  const cancel = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.onstop = null
      recorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setBlob(null)
    cleanup()
    setRecording(false)
  }, [cleanup])

  const start = useCallback(async () => {
    setError(null)
    setBlob(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : ''
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        chunksRef.current = []
        setBlob(finalBlob)
        streamRef.current?.getTracks().forEach((t) => t.stop())
        cleanup()
        setRecording(false)
      }

      recorder.start()
      setRecording(true)
      setDuration(0)
      timerRef.current = window.setInterval(() => {
        setDuration((d) => {
          if (d + 1 >= MAX_SECONDS) {
            recorderRef.current?.stop()
            return MAX_SECONDS
          }
          return d + 1
        })
      }, 1000)
    } catch {
      setError('Could not access your microphone')
      setRecording(false)
    }
  }, [cleanup])

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.onstop = null
        recorderRef.current.stop()
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [])

  const formatDuration = useCallback((seconds: number) => {
    const s = Math.max(0, Math.min(Math.floor(seconds), MAX_SECONDS))
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }, [])

  return { recording, duration, blob, error, start, stop, cancel, formatDuration }
}
