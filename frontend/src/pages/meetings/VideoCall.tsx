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
} from 'lucide-react'
import Peer from 'peerjs'
import type { DataConnection, MediaConnection } from 'peerjs'

const ROOM_PREFIX = 'founderhub-meet-'

type Status = 'connecting' | 'waiting' | 'connected' | 'error'

interface ChatMsg {
  id: string
  text: string
  from: 'me' | 'them'
  time: string
}

type MediaConnectionWithReplace = MediaConnection & {
  replaceTrack(track: MediaStreamTrack, audioStream?: MediaStream | null): void
}

function mediaErrorText(e: unknown, video: boolean): string {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return video
      ? 'Camera/microphone access is blocked. Click the camera icon in the address bar, allow access, then retry.'
      : 'Microphone access is blocked. Allow mic access in the address bar, then retry.'
  }
  if (name === 'NotFoundError') {
    return video
      ? 'No camera found. Connect a camera, or the call will continue with audio only.'
      : 'No microphone found. Connect a microphone and retry.'
  }
  if (name === 'NotReadableError') {
    return 'Your camera or mic is in use by another app. Close it and retry.'
  }
  return video
    ? 'Could not access your camera or microphone. Check permissions and retry.'
    : 'Could not access your microphone. Check permissions and retry.'
}

export default function VideoCall() {
  const { roomId = '' } = useParams<{ roomId: string }>()
  const [status, setStatus] = useState<Status>('connecting')
  const [error, setError] = useState('')
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

  const localRef = useRef<HTMLVideoElement | null>(null)
  const remoteRef = useRef<HTMLVideoElement | null>(null)
  const mainRef = useRef<HTMLDivElement | null>(null)
  const chatBoxRef = useRef<HTMLDivElement | null>(null)
  const peersRef = useRef<Peer[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const activeCallRef = useRef<MediaConnection | null>(null)
  const dataConnRef = useRef<DataConnection | null>(null)
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null)

  const roomUrl = `${window.location.origin}/meet/${roomId}`

  // Keep chat-open state available inside the data handler.
  const chatOpenRef = useRef(chatOpen)
  useEffect(() => {
    chatOpenRef.current = chatOpen
  }, [chatOpen])

  const pushMsg = useCallback((m: Omit<ChatMsg, 'id' | 'time'>) => {
    setChatMsgs((prev) => [
      ...prev,
      { ...m, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) },
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
    let cancelled = false
    let hostPeer: Peer | null = null
    let guestPeer: Peer | null = null
    const roomPeerId = `${ROOM_PREFIX}${roomId}`

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
        setError(
          'Camera & mic need a secure connection (HTTPS or localhost). Open this room on http://localhost:5173 or deploy the app to HTTPS.',
        )
        return null
      }
      const videoConstraints = {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
      }
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints,
        })
        return stream
      } catch {
        // No camera or camera busy — fall back to audio only.
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: audioConstraints,
          })
          setAudioOnly(true)
          return stream
        } catch (e2) {
          setStatus('error')
          setError(mediaErrorText(e2, false))
          return null
        }
      }
    }

    const watchTracks = () => {
      if (!streamRef.current) return
      const audioTrack = streamRef.current.getAudioTracks()[0]
      const videoTrack = streamRef.current.getVideoTracks()[0]
      setMuted(audioTrack?.enabled === false)
      setCameraOff(!videoTrack || videoTrack.enabled === false)
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
            setError('Could not reach the other participant. Check that you both opened the same meeting link.')
            return
          }
          const call = guestPeer!.call(roomPeerId, stream)
          activeCallRef.current = call
          call.on('stream', (remote) => {
            if (cancelled) return
            setIncoming(false)
            setStatus('connected')
            if (remoteRef.current) {
              remoteRef.current.srcObject = remote
              remoteRef.current.play().catch(() => {})
            }
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
          if (remoteRef.current) {
            remoteRef.current.srcObject = remote
            remoteRef.current.play().catch(() => {})
          }
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
          startGuest()
        } else if (err.type === 'network' || err.type === 'socket-error' || err.type === 'server-error') {
          setStatus('error')
          setError('Could not connect to the meeting server. Check your internet connection and retry.')
        }
      })
    }

    init()

    return cleanup
  }, [roomId, pushMsg])

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
      // user cancelled the picker
    }
  }

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked — show the link so it can be copied manually
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
    window.location.href = '/meetings'
  }

  return (
    <div ref={mainRef} className="flex min-h-screen flex-col bg-[#0d0d0f] text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <Link to="/meetings" className="text-sm text-gray-400 hover:text-white">
          ← Back to Meetings
        </Link>
        <div className="flex items-center gap-2">
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
              <video
                ref={remoteRef}
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
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

            {/* Local video */}
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

          {/* Chat panel */}
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
                  <p className="text-center text-[11px] text-gray-500">
                    Chat connects when the other person joins.
                  </p>
                )}
                {chatMsgs.length === 0 && peerReady && (
                  <p className="text-center text-[11px] text-gray-500">Say hello 👋</p>
                )}
                {chatMsgs.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm ${
                      m.from === 'me'
                        ? 'ml-auto bg-primary text-white'
                        : 'bg-white/10 text-gray-200'
                    }`}
                  >
                    <p className="break-words">{m.text}</p>
                    <p
                      className={`mt-0.5 text-[10px] ${
                        m.from === 'me' ? 'text-white/70' : 'text-gray-500'
                      }`}
                    >
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
                <button
                  type="submit"
                  aria-label="Send message"
                  className="rounded-lg bg-primary p-2 text-white"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="mt-6 flex items-center gap-3">
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
          <p className="mt-3 text-xs text-gray-500">Camera unavailable — you joined with audio only.</p>
        )}
      </main>
    </div>
  )
}
