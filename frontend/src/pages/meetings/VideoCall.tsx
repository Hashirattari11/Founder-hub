import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Loader2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  PhoneCall,
  RotateCcw,
  AudioLines,
  Copy,
  Check,
  Send,
  MessageSquare,
  Maximize,
  Minimize,
  MonitorUp,
  X,
  Crown,
  Users,
} from 'lucide-react'
import Peer from 'peerjs'
import type { DataConnection, MediaConnection } from 'peerjs'

const ROOM_PREFIX = 'founderhub-meet-'

type Status = 'lobby' | 'connecting' | 'waiting' | 'connected' | 'error'

interface ChatMsg {
  id: string
  text: string
  from: 'me' | 'them'
  time: string
}

interface JoinPrefs {
  mic: boolean
  camera: boolean
  hd: boolean
}

type MediaConnectionWithReplace = MediaConnection & {
  replaceTrack(track: MediaStreamTrack, audioStream?: MediaStream | null): void
}

function mediaErrorText(e: unknown, wantsVideo: boolean): string {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return wantsVideo
      ? 'Camera/microphone access is blocked. Click the lock icon in the address bar, allow access, then retry.'
      : 'Microphone access is blocked. Allow mic access in the address bar, then retry.'
  }
  if (name === 'NotFoundError') {
    return wantsVideo
      ? 'No camera found. You can join with audio only.'
      : 'No microphone found. Connect a microphone and retry.'
  }
  if (name === 'NotReadableError') {
    return 'Your camera or mic is in use by another app. Close it and retry.'
  }
  return wantsVideo
    ? 'Could not access your camera or microphone. Check permissions and retry.'
    : 'Could not access your microphone. Check permissions and retry.'
}

function buildConstraints(prefs: JoinPrefs): MediaStreamConstraints {
  const audio = prefs.mic
    ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    : false
  if (!prefs.camera) {
    return { video: false, audio }
  }
  return {
    audio,
    video: prefs.hd
      ? { width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: { ideal: 30, max: 60 } }
      : { width: { ideal: 640, max: 1280 }, height: { ideal: 480, max: 720 }, frameRate: { ideal: 24, max: 30 } },
  }
}

export default function VideoCall() {
  const { roomId = '' } = useParams<{ roomId: string }>()
  const [status, setStatus] = useState<Status>('lobby')
  const [error, setError] = useState('')
  const [joined, setJoined] = useState(false)
  const [prefMic, setPrefMic] = useState(true)
  const [prefCamera, setPrefCamera] = useState(true)
  const [prefHd, setPrefHd] = useState(true)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [audioOnly, setAudioOnly] = useState(false)
  const [incoming, setIncoming] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([])
  const [unread, setUnread] = useState(0)
  const [copied, setCopied] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [peerReady, setPeerReady] = useState(false)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [previewReady, setPreviewReady] = useState(false)

  const localRef = useRef<HTMLVideoElement | null>(null)
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const remoteRef = useRef<HTMLVideoElement | null>(null)
  const mainRef = useRef<HTMLDivElement | null>(null)
  const chatBoxRef = useRef<HTMLDivElement | null>(null)
  const peersRef = useRef<Peer[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const previewStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const activeCallRef = useRef<MediaConnection | null>(null)
  const dataConnRef = useRef<DataConnection | null>(null)
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null)
  const prefsRef = useRef<JoinPrefs>({ mic: true, camera: true, hd: true })

  const roomUrl = `${window.location.origin}/meet/${roomId}`

  useEffect(() => {
    prefsRef.current = { mic: prefMic, camera: prefCamera, hd: prefHd }
  }, [prefMic, prefCamera, prefHd])

  const chatOpenRef = useRef(chatOpen)
  useEffect(() => {
    chatOpenRef.current = chatOpen
  }, [chatOpen])

  const pushMsg = useCallback((m: Omit<ChatMsg, 'id' | 'time'>) => {
    setChatMsgs((prev) => [
      ...prev,
      {
        ...m,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      },
    ])
  }, [])

  const sendChat = () => {
    const text = chatInput.trim()
    if (!text) return
    pushMsg({ text, from: 'me' })
    const conn = dataConnRef.current
    if (conn?.open) conn.send(JSON.stringify({ type: 'chat', text }))
    setChatInput('')
  }

  useEffect(() => {
    if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight
  }, [chatMsgs])

  useEffect(() => {
    if (status !== 'connected' || !remoteStream || !remoteRef.current) return
    remoteRef.current.srcObject = remoteStream
    remoteRef.current.play().catch(() => {})
  }, [status, remoteStream])

  // Lobby preview — show camera/mic state before joining.
  useEffect(() => {
    if (status !== 'lobby') return
    let cancelled = false
    setPreviewReady(false)

    const secure =
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia

    if (!secure) {
      setError(
        `Camera & mic need HTTPS or localhost. Open this room on ${window.location.origin}.`,
      )
      return
    }

    previewStreamRef.current?.getTracks().forEach((t) => t.stop())
    previewStreamRef.current = null

    const run = async () => {
      try {
        const constraints = buildConstraints({ mic: prefMic, camera: prefCamera, hd: prefHd })
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        previewStreamRef.current = stream
        if (previewRef.current) {
          previewRef.current.srcObject = stream
          previewRef.current.play().catch(() => {})
        }
        setPreviewReady(true)
      } catch (e) {
        if (cancelled) return
        if (prefCamera) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: prefMic ? { echoCancellation: true, noiseSuppression: true } : false,
            })
            if (cancelled) {
              stream.getTracks().forEach((t) => t.stop())
              return
            }
            previewStreamRef.current = stream
            if (previewRef.current) previewRef.current.srcObject = stream
            setPreviewReady(true)
          } catch (e2) {
            setError(mediaErrorText(e2, false))
          }
        } else {
          setError(mediaErrorText(e, prefCamera))
        }
      }
    }
    void run()

    return () => {
      cancelled = true
      previewStreamRef.current?.getTracks().forEach((t) => t.stop())
      previewStreamRef.current = null
    }
  }, [status, prefMic, prefCamera, prefHd])

  useEffect(() => {
    if (!joined) return
    let cancelled = false
    let hostPeer: Peer | null = null
    let guestPeer: Peer | null = null
    const roomPeerId = `${ROOM_PREFIX}${roomId}`
    const prefs = prefsRef.current

    const cleanup = () => {
      cancelled = true
      activeCallRef.current?.close()
      activeCallRef.current = null
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null
      for (const p of peersRef.current) p.destroy()
      peersRef.current = []
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    const secureContext =
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia

    const acquireMedia = async (): Promise<MediaStream | null> => {
      if (!secureContext) {
        setStatus('error')
        setError(`Camera & mic need HTTPS or localhost. Open this room on ${window.location.origin}.`)
        return null
      }

      previewStreamRef.current?.getTracks().forEach((t) => t.stop())
      previewStreamRef.current = null

      try {
        const stream = await navigator.mediaDevices.getUserMedia(buildConstraints(prefs))
        if (!prefs.camera) setAudioOnly(true)
        if (!prefs.mic) setMuted(true)
        if (!prefs.camera) setCameraOff(true)
        return stream
      } catch {
        if (prefs.camera) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: prefs.mic ? { echoCancellation: true, noiseSuppression: true } : false,
            })
            setAudioOnly(true)
            setCameraOff(true)
            if (!prefs.mic) setMuted(true)
            return stream
          } catch (e2) {
            setStatus('error')
            setError(mediaErrorText(e2, false))
            return null
          }
        }
        setStatus('error')
        setError(mediaErrorText(new Error('media'), prefs.camera))
        return null
      }
    }

    const watchTracks = () => {
      if (!streamRef.current) return
      const audioTrack = streamRef.current.getAudioTracks()[0]
      const videoTrack = streamRef.current.getVideoTracks()[0]
      setMuted(!audioTrack || audioTrack.enabled === false)
      setCameraOff(!videoTrack || videoTrack.enabled === false)
    }

    const handleHostCommand = (msg: { type?: string }) => {
      if (msg?.type === 'mute-all') {
        streamRef.current?.getAudioTracks().forEach((t) => {
          t.enabled = false
        })
        setMuted(true)
      }
    }

    const attachDataChannel = (conn: DataConnection) => {
      conn.on('open', () => {
        dataConnRef.current = conn
        setPeerReady(true)
      })
      conn.on('data', (data) => {
        try {
          const msg = JSON.parse(String(data))
          if (msg?.type === 'chat' && typeof msg.text === 'string') {
            pushMsg({ text: msg.text, from: 'them' })
            setUnread((n) => (chatOpenRef.current ? n : n + 1))
          } else {
            handleHostCommand(msg)
          }
        } catch {
          // ignore non-JSON
        }
      })
      conn.on('close', () => {
        dataConnRef.current = null
        setPeerReady(false)
      })
    }

    const openGuestDataChannel = () => {
      const gp = guestPeer
      if (!gp) return
      const attempt = (left: number) => {
        if (cancelled) return
        const conn = gp.connect(roomPeerId, { reliable: true })
        attachDataChannel(conn)
        conn.on('error', () => {
          if (left > 0) setTimeout(() => attempt(left - 1), 1500)
        })
      }
      attempt(12)
    }

    const startGuest = async () => {
      const stream = streamRef.current
      if (!stream) return
      setIsHost(false)
      guestPeer = new Peer()
      peersRef.current.push(guestPeer)
      guestPeer.on('open', () => {
        if (cancelled) return
        setStatus('waiting')
        openGuestDataChannel()
        const attempt = (left: number) => {
          if (cancelled) return
          if (left <= 0) {
            setStatus('error')
            setError('Could not reach the other participant. Make sure you both opened the same meeting link.')
            return
          }
          const call = guestPeer!.call(roomPeerId, stream)
          activeCallRef.current = call
          call.on('stream', (remote) => {
            if (cancelled) return
            setIncoming(false)
            setStatus('connected')
            setRemoteStream(remote)
          })
          call.on('close', () => {
            if (!cancelled) setStatus('waiting')
          })
          call.on('error', () => {
            setTimeout(() => attempt(left - 1), 1500)
          })
        }
        attempt(12)
      })
    }

    const init = async () => {
      setStatus('connecting')
      const stream = await acquireMedia()
      if (cancelled || !stream) return
      streamRef.current = stream
      cameraTrackRef.current = stream.getVideoTracks()[0] ?? null
      if (localRef.current) {
        localRef.current.srcObject = stream
        localRef.current.play().catch(() => {})
      }
      watchTracks()

      hostPeer = new Peer(roomPeerId)
      peersRef.current.push(hostPeer)

      hostPeer.on('open', () => {
        if (cancelled) return
        setIsHost(true)
        setStatus('waiting')
      })

      hostPeer.on('call', (call) => {
        if (cancelled) return
        activeCallRef.current = call
        setIncoming(true)
        call.answer(streamRef.current!)
        call.on('stream', (remote) => {
          setIncoming(false)
          setStatus('connected')
          setRemoteStream(remote)
        })
        call.on('close', () => {
          if (!cancelled) setStatus('waiting')
        })
      })

      hostPeer.on('connection', attachDataChannel)

      hostPeer.on('error', (err) => {
        if (cancelled) return
        if (err.type === 'unavailable-id') {
          hostPeer?.destroy()
          peersRef.current = peersRef.current.filter((p) => p !== hostPeer)
          void startGuest()
        } else if (err.type === 'network' || err.type === 'socket-error' || err.type === 'server-error') {
          setStatus('error')
          setError('Could not connect to the meeting server. Check your internet connection and retry.')
        }
      })
    }

    void init()
    return cleanup
  }, [roomId, joined, pushMsg])

  const joinMeeting = () => {
    setError('')
    setJoined(true)
  }

  const toggleMute = () => {
    const tracks = streamRef.current?.getAudioTracks()
    if (!tracks?.length) return
    const enabled = !tracks[0].enabled
    tracks.forEach((t) => (t.enabled = enabled))
    setMuted(!enabled)
  }

  const toggleCamera = () => {
    const tracks = streamRef.current?.getVideoTracks()
    if (!tracks?.length) return
    const enabled = !tracks[0].enabled
    tracks.forEach((t) => (t.enabled = enabled))
    setCameraOff(!enabled)
  }

  const muteAllParticipants = () => {
    const conn = dataConnRef.current
    if (conn?.open) conn.send(JSON.stringify({ type: 'mute-all' }))
  }

  const toggleScreenShare = async () => {
    if (sharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null
      const camTrack = cameraTrackRef.current
      if (camTrack && activeCallRef.current) {
        ;(activeCallRef.current as MediaConnectionWithReplace).replaceTrack(camTrack)
      }
      if (localRef.current && streamRef.current) {
        localRef.current.srcObject = streamRef.current
      }
      setSharing(false)
      return
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
      })
      const track = screen.getVideoTracks()[0]
      if (!track) return
      screenStreamRef.current = screen
      if (localRef.current) {
        localRef.current.srcObject = screen
        localRef.current.play().catch(() => {})
      }
      if (activeCallRef.current) {
        ;(activeCallRef.current as MediaConnectionWithReplace).replaceTrack(track)
      }
      track.onended = () => toggleScreenShare()
      setSharing(true)
    } catch {
      // user cancelled picker
    }
  }

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(`Meeting link: ${roomUrl}`)
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mainRef.current?.requestFullscreen?.()
      setFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setFullscreen(false)
    }
  }

  const leave = () => {
    for (const p of peersRef.current) p.destroy()
    peersRef.current = []
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    previewStreamRef.current?.getTracks().forEach((t) => t.stop())
    window.location.href = '/'
  }

  if (status === 'lobby') {
    return (
      <div className="flex min-h-screen flex-col bg-[#0d0d0f] text-white">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <Link to="/meetings" className="text-sm text-gray-400 hover:text-white">
            ← Back to Meetings
          </Link>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
            Room {roomId.slice(0, 8)}
          </span>
        </header>

        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8">
          <h1 className="text-center text-xl font-bold">Ready to join?</h1>
          <p className="mt-1 text-center text-sm text-gray-400">
            Choose your camera, microphone, and video quality before entering.
          </p>

          <div className="relative mx-auto mt-6 aspect-video w-full overflow-hidden rounded-2xl bg-black">
            <video
              ref={previewRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${!prefCamera ? 'opacity-0' : ''}`}
            />
            {!prefCamera && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500">
                <VideoOff className="h-10 w-10" />
                <p className="text-xs">Camera off</p>
              </div>
            )}
            {!previewReady && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>

          {error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}

          <div className="mt-6 space-y-3">
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-3">
                {prefMic ? <Mic className="h-5 w-5 text-green-400" /> : <MicOff className="h-5 w-5 text-red-400" />}
                <div>
                  <p className="text-sm font-semibold">Microphone</p>
                  <p className="text-xs text-gray-500">{prefMic ? 'On — others will hear you' : 'Off — join muted'}</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefMic}
                onChange={(e) => setPrefMic(e.target.checked)}
                className="h-5 w-5 rounded accent-primary"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-3">
                {prefCamera ? <Video className="h-5 w-5 text-green-400" /> : <VideoOff className="h-5 w-5 text-red-400" />}
                <div>
                  <p className="text-sm font-semibold">Camera</p>
                  <p className="text-xs text-gray-500">{prefCamera ? 'On — others will see you' : 'Off — audio only'}</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefCamera}
                onChange={(e) => setPrefCamera(e.target.checked)}
                className="h-5 w-5 rounded accent-primary"
              />
            </label>

            <label
              className={`flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 ${!prefCamera ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <MonitorUp className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">HD video (1080p)</p>
                  <p className="text-xs text-gray-500">{prefHd ? 'Higher quality — needs good bandwidth' : 'Standard quality (480p)'}</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefHd}
                disabled={!prefCamera}
                onChange={(e) => setPrefHd(e.target.checked)}
                className="h-5 w-5 rounded accent-primary disabled:opacity-40"
              />
            </label>
          </div>

          <button
            onClick={joinMeeting}
            disabled={!!error}
            className="btn-primary mt-8 w-full py-3 text-base disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PhoneCall className="h-5 w-5" />
            Join meeting
          </button>

          <button
            onClick={copyInvite}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-sm text-gray-300 hover:bg-white/5"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Invite link copied' : 'Copy invite link'}
          </button>
        </main>
      </div>
    )
  }

  return (
    <div ref={mainRef} className="flex min-h-screen flex-col bg-[#0d0d0f] text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <Link to="/meetings" className="text-sm text-gray-400 hover:text-white">
          ← Back to Meetings
        </Link>
        <div className="flex items-center gap-2">
          {isHost && status === 'connected' && (
            <span className="hidden items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-300 sm:inline-flex">
              <Crown className="h-3 w-3" /> Host
            </span>
          )}
          <span className="hidden rounded-full bg-white/10 px-3 py-1 text-xs font-semibold sm:block">
            Room {roomId.slice(0, 8)}
          </span>
          <button
            onClick={copyInvite}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/20"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Link copied' : 'Copy invite link'}
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="flex w-full max-w-5xl gap-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
            {status === 'connected' && remoteRef.current ? (
              <video ref={remoteRef} autoPlay playsInline className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-gray-400">
                {status === 'connecting' ? (
                  <>
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p>Connecting to the call…</p>
                  </>
                ) : status === 'error' ? (
                  <>
                    <p className="max-w-md text-center text-red-400">{error}</p>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => window.location.reload()} className="btn-primary">
                        <RotateCcw className="h-4 w-4" />
                        Try again
                      </button>
                      <Link to="/meetings" className="btn-ghost">
                        Back to Meetings
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <PhoneCall className="h-10 w-10 animate-pulse text-primary" />
                    <p>{incoming ? 'Incoming call — answering…' : 'Waiting for the other person…'}</p>
                    <button
                      onClick={copyInvite}
                      className="mt-1 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/20"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Link copied — send it to them' : 'Copy invite link'}
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="absolute bottom-4 right-4 h-28 w-44 overflow-hidden rounded-xl border border-white/20 bg-black">
              <video
                ref={localRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${cameraOff && !sharing ? 'opacity-0' : ''}`}
              />
              {(cameraOff || audioOnly) && !sharing && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  {audioOnly ? <AudioLines className="h-8 w-8" /> : <VideoOff className="h-8 w-8" />}
                </div>
              )}
              {sharing && (
                <span className="absolute left-1 top-1 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold">
                  LIVE
                </span>
              )}
            </div>
          </div>

          {chatOpen && (
            <div className="flex w-full max-w-xs flex-col rounded-2xl border border-white/10 bg-[#161618]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <p className="text-sm font-semibold">Meeting chat</p>
                <button
                  onClick={() => setChatOpen(false)}
                  aria-label="Close chat"
                  className="rounded-lg p-1 text-gray-400 hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div ref={chatBoxRef} className="flex-1 space-y-2 overflow-y-auto p-3">
                {!peerReady && (
                  <p className="text-center text-[11px] text-gray-500">Chat connects when the other person joins.</p>
                )}
                {chatMsgs.length === 0 && peerReady && (
                  <p className="text-center text-[11px] text-gray-500">Say hello 👋</p>
                )}
                {chatMsgs.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm ${
                      m.from === 'me' ? 'ml-auto bg-primary text-white' : 'bg-white/10 text-gray-200'
                    }`}
                  >
                    <p className="break-words">{m.text}</p>
                    <p className={`mt-0.5 text-[10px] ${m.from === 'me' ? 'text-white/70' : 'text-gray-500'}`}>
                      {m.from === 'me' ? 'You' : 'Guest'} · {m.time}
                    </p>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendChat()
                }}
                className="flex items-center gap-2 border-t border-white/10 p-3"
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message…"
                  className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-gray-500"
                />
                <button type="submit" aria-label="Send message" className="rounded-lg bg-primary p-2 text-white">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={toggleMute}
            aria-label="Toggle microphone"
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
              muted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            onClick={toggleCamera}
            aria-label="Toggle camera"
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
              cameraOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>
          {isHost && status === 'connected' && (
            <button
              onClick={muteAllParticipants}
              aria-label="Mute all participants"
              title="Mute everyone (host only)"
              className="flex h-12 items-center gap-2 rounded-full bg-amber-600/90 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-500"
            >
              <Users className="h-4 w-4" />
              Mute all
            </button>
          )}
          <button
            onClick={toggleScreenShare}
            aria-label="Share screen"
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
              sharing ? 'bg-green-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <MonitorUp className="h-5 w-5" />
          </button>
          <button
            onClick={() => setChatOpen((v) => !v)}
            aria-label="Toggle chat"
            className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <MessageSquare className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold">
                {unread}
              </span>
            )}
          </button>
          <button
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
          <button
            onClick={leave}
            aria-label="Leave call"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white transition-transform hover:scale-105"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>

        {audioOnly && (
          <p className="mt-3 text-xs text-gray-500">You joined without camera — audio only.</p>
        )}
        {muted && joined && (
          <p className="mt-1 text-xs text-gray-500">Your microphone is off.</p>
        )}
      </main>
    </div>
  )
}
