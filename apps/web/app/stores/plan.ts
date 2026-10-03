import {
  applyOp,
  applyOps,
  coalesceOps,
  diffOps,
  newHorse,
  pathTargets,
  peerMarks,
  serverMessageSchema,
  type ClientMessage,
  type Horse,
  type Part,
  type PeerInfo,
  type Plan,
  type PlanContent,
  type PlanOp,
  type PlanSettings,
  type ServerMessage,
  type SingleOp,
  type Timing,
} from '@zephyr/core'
import { useDebounceFn, useIntervalFn, useThrottleFn, useWebSocket } from '@vueuse/core'

export type PlanRole = 'viewer' | 'editor' | 'owner'
/** Without a connection the plan is read-only (SPEC "Speichern und Konflikte"). */
export type SaveStatus = 'saved' | 'saving' | 'offline'

/** Changes made within this window travel as one message. */
const FLUSH_MS = 120
const FLUSH_MAX_MS = 500
/** Most parts in one `batch` (the server accepts 100) and most characters (it closes at 5 M). */
const BATCH_MAX = 100
const BATCH_CHARS = 1_000_000
/**
 * Close codes after which reconnecting is pointless: 1003 bad message, 1008 access gone (deleted
 * plan, sharing ended, blocked account) or rate limit, 1009 message too big. A retry would send
 * the same unconfirmed operations again.
 */
const STOP_CODES = [1003, 1008, 1009]
/** Undo steps kept (SPEC "Zustand"). */
const HISTORY_MAX = 150

type Hello = Extract<ServerMessage, { type: 'hello' }>
type Ack = Extract<ServerMessage, { type: 'ack' }>
type Reject = Extract<ServerMessage, { type: 'reject' }>
type RemoteOp = Extract<ServerMessage, { type: 'op' }>

const writable = (r: PlanRole | null) => r === 'editor' || r === 'owner'

/**
 * The open plan document, edited live (SPEC "Speichern und Konflikte"). `confirmed` is the
 * document as the server has it; `plan` is what is shown: confirmed plus our own operations the
 * server has not confirmed yet. Last write wins, so a remote operation is applied to `confirmed`
 * and our unconfirmed operations are laid over it again.
 */
export const usePlanStore = defineStore('plan', () => {
  const editor = useEditorStore()
  const confirmed = shallowRef<Plan | null>(null)
  const plan = shallowRef<Plan | null>(null)
  const role = shallowRef<PlanRole | null>(null)
  const peers = shallowRef<PeerInfo[]>([])
  const connected = shallowRef(false)
  const unconfirmed = shallowRef(0)

  let planId = ''
  let seq = 0
  /** the connection was lost or reset since the last `hello`: unconfirmed operations are resent */
  let needsResend = false
  /** sent, not yet confirmed */
  let inflight: { seq: number; op: PlanOp }[] = []
  /** produced, not yet sent (collected for FLUSH_MS) */
  let outbox: SingleOp[] = []
  let socket: ReturnType<typeof useWebSocket> | null = null

  const canEdit = computed(() => connected.value && writable(role.value))
  const dirty = computed(() => unconfirmed.value > 0)
  const status = computed<SaveStatus>(() =>
    !connected.value ? 'offline' : unconfirmed.value > 0 ? 'saving' : 'saved',
  )
  const marks = computed(() => peerMarks(peers.value))

  const content = (p: Plan): PlanContent => {
    const { id: _id, revision: _rev, ...c } = p
    return c
  }
  const withContent = (p: Plan, c: PlanContent): Plan => ({ ...p, ...c })
  const countUnconfirmed = () => (unconfirmed.value = inflight.length + outbox.length)

  /** shown plan = confirmed plan + our own operations that are still open */
  function rebuild() {
    const c = confirmed.value
    if (!c) return
    const open: PlanOp[] = [...inflight.map((i) => i.op), ...outbox]
    plan.value = withContent(c, applyOps(content(c), open))
  }

  // ---------- connection ----------

  function send(msg: ClientMessage): boolean {
    return socket?.send(JSON.stringify(msg)) ?? false
  }

  function connect() {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
    socket = useWebSocket(`${scheme}://${location.host}/ws/plans/${planId}`, {
      // the page closes the socket itself (`close()` on unmount); VueUse's default would also
      // close it on `beforeunload`, even when the person chooses to stay
      autoClose: false,
      autoReconnect: { retries: () => true, delay: 1500 },
      // keeps the connection open behind proxies and notices a dead one
      heartbeat: {
        message: JSON.stringify({ type: 'ping' }),
        scheduler: (cb) => useIntervalFn(cb, 25_000),
        pongTimeout: 10_000,
      },
      onDisconnected: (ws, e) => {
        // a late close of a replaced socket must not mark the new one offline
        if (ws !== socket?.ws.value) return
        connected.value = false
        needsResend = true
        if (STOP_CODES.includes(e.code)) close()
      },
      onMessage: (_ws, e) => onMessage(e.data),
    })
  }

  function close() {
    socket?.close()
    socket = null
    connected.value = false
    needsResend = false
  }

  /** Reconnects to get a fresh document (after a gap in the revisions). */
  function resync() {
    connected.value = false
    needsResend = true
    socket?.open()
  }

  function onMessage(raw: unknown) {
    if (typeof raw !== 'string') return
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return
    }
    const parsed = serverMessageSchema.safeParse(json)
    if (!parsed.success) return
    const m = parsed.data
    switch (m.type) {
      case 'hello':
        return onHello(m)
      case 'ack':
        return onAck(m)
      case 'reject':
        return onReject(m)
      case 'op':
        return onRemoteOp(m)
      case 'presence':
        peers.value = [...peers.value.filter((p) => p.peerId !== m.peer.peerId), m.peer]
        return
      case 'leave':
        peers.value = peers.value.filter((p) => p.peerId !== m.peerId)
        return
      case 'pong':
        return
    }
  }

  function onHello(m: Hello) {
    // `hello` also comes on a live socket after a change outside it (PUT, sharing): operations
    // still in flight are not lost then, so they are resent only after a real reconnect
    const reconnected = needsResend
    needsResend = false
    // after a reconnect the undo steps may refer to horses somebody else changed meanwhile
    if (reconnected) history.value = []
    confirmed.value = m.plan
    role.value = m.role
    peers.value = m.peers
    connected.value = true
    // the role dropped to viewer: what is still open can never be accepted
    if (!writable(m.role)) {
      inflight = []
      outbox = []
      countUnconfirmed()
    }
    rebuild()
    if (reconnected) for (const i of inflight) send({ type: 'op', seq: i.seq, op: i.op })
    flush()
    sendPresence()
  }

  /** The server refused this change (invalid or forbidden): show the server's version again. */
  function onReject(m: Reject) {
    const at = inflight.findIndex((i) => i.seq === m.seq)
    if (at < 0) return
    inflight.splice(at, 1)
    countUnconfirmed()
    rebuild()
  }

  function onAck(m: Ack) {
    const at = inflight.findIndex((i) => i.seq === m.seq)
    const c = confirmed.value
    if (at < 0 || !c) return
    const [sent] = inflight.splice(at, 1)
    if (sent && m.revision > c.revision) {
      if (m.revision !== c.revision + 1) return resync()
      confirmed.value = { ...c, ...applyOp(content(c), m.op ?? sent.op), revision: m.revision }
      // the server normalized our operation: show its version
      if (m.op) rebuild()
    }
    countUnconfirmed()
  }

  function onRemoteOp(m: RemoteOp) {
    const c = confirmed.value
    if (!c || m.revision <= c.revision) return
    if (m.revision !== c.revision + 1) return resync()
    confirmed.value = { ...c, ...applyOp(content(c), m.op), revision: m.revision }
    pruneHistory(pathTargets(m.op))
    rebuild()
  }

  async function load(id: string) {
    close()
    const res = await $fetch<Plan & { role: PlanRole }>(`/api/plans/${id}`)
    const { role: r, ...doc } = res
    planId = id
    confirmed.value = doc
    plan.value = doc
    role.value = r
    peers.value = []
    history.value = []
    inflight = []
    outbox = []
    seq = 0
    countUnconfirmed()
    connect()
  }

  // ---------- sending changes ----------

  function flush() {
    if (!connected.value || !writable(role.value) || !outbox.length) return
    const ops = coalesceOps(outbox)
    outbox = []
    let chunk: SingleOp[] = []
    let chars = 0
    const sendChunk = () => {
      const [only] = chunk
      const op: PlanOp = chunk.length === 1 && only ? only : { t: 'batch', ops: chunk }
      const entry = { seq: seq++, op }
      inflight.push(entry)
      send({ type: 'op', seq: entry.seq, op })
      chunk = []
      chars = 0
    }
    for (const o of ops) {
      const size = JSON.stringify(o).length
      if (chunk.length && (chunk.length >= BATCH_MAX || chars + size > BATCH_CHARS)) sendChunk()
      chunk.push(o)
      chars += size
    }
    if (chunk.length) sendChunk()
    countUnconfirmed()
  }
  const scheduleFlush = useDebounceFn(flush, FLUSH_MS, { maxWait: FLUSH_MAX_MS })

  /** Applies a change to the document and sends it as operations. */
  function update(fn: (c: PlanContent) => PlanContent) {
    const p = plan.value
    if (!p || !canEdit.value) return
    const before = content(p)
    const after = fn(before)
    const ops = diffOps(before, after)
    if (!ops.length) return
    plan.value = withContent(p, after)
    outbox.push(...ops)
    countUnconfirmed()
    void scheduleFlush()
  }

  // ---------- presence ----------

  function sendPresence() {
    if (!connected.value) return
    send({
      type: 'presence',
      activeHorseId: editor.activeHorseId,
      selection: [...editor.selection],
    })
  }
  const sendPresenceThrottled = useThrottleFn(sendPresence, 100, true, true)
  watch(
    () => [editor.activeHorseId, editor.selection] as const,
    () => void sendPresenceThrottled(),
  )

  // ---------- plan-level changes ----------

  const rename = (title: string) => update((c) => ({ ...c, title }))
  const setSettings = (patch: Partial<PlanSettings>) =>
    update((c) => ({ ...c, settings: { ...c.settings, ...patch } }))
  const setTiming = (patch: Partial<Timing>) =>
    update((c) => ({ ...c, timing: { ...c.timing, ...patch } }))
  /** Parts are not part of the undo history (as in the prototype, undo only covers paths). */
  const setParts = (fn: (parts: readonly Part[]) => Part[]) =>
    update((c) => ({ ...c, parts: fn(c.parts) }))

  // ---------- horses ----------

  const mapHorse = (id: string, fn: (h: Horse) => Horse) =>
    update((c) => ({ ...c, horses: c.horses.map((h) => (h.id === id ? fn(h) : h)) }))

  function addHorse(name: (n: number) => string): string {
    const id = crypto.randomUUID()
    update((c) => ({ ...c, horses: [...c.horses, newHorse(c.horses, id, name)] }))
    return id
  }
  const updateHorse = (id: string, patch: Partial<Pick<Horse, 'name' | 'color' | 'tack'>>) =>
    mapHorse(id, (h) => ({ ...h, ...patch }))

  // ---------- path changes with undo (SPEC "useHistory"), per person ----------

  /** One entry: path and announced gap of every horse an action changed (group = one step). */
  type HistoryEntry = Map<string, Pick<Horse, 'path' | 'pending'>>
  const history = shallowRef<HistoryEntry[]>([])

  /**
   * Somebody else changed or removed these horses: our undo steps for them are void, so undo
   * never overwrites foreign work (SPEC "Verlauf je Person").
   */
  function pruneHistory(horseIds: readonly string[]) {
    if (!horseIds.length || !history.value.length) return
    const next: HistoryEntry[] = []
    for (const entry of history.value) {
      const kept: HistoryEntry = new Map([...entry].filter(([id]) => !horseIds.includes(id)))
      if (kept.size) next.push(kept)
    }
    history.value = next
  }

  /** Changes paths of one or more horses as a single undo step. */
  function editHorses(fn: (horses: readonly Horse[]) => readonly Horse[]) {
    const p = plan.value
    if (!p || !canEdit.value) return
    const next = fn(p.horses)
    const entry: HistoryEntry = new Map()
    for (const h of p.horses) {
      const n = next.find((q) => q.id === h.id)
      if (n && (n.path !== h.path || n.pending !== h.pending))
        entry.set(h.id, { path: h.path, pending: h.pending })
    }
    if (!entry.size) return
    history.value = [...history.value, entry].slice(-HISTORY_MAX)
    update((c) => ({ ...c, horses: [...next] }))
  }

  function undo() {
    const entry = history.value.at(-1)
    if (!entry) return
    history.value = history.value.slice(0, -1)
    update((c) => ({
      ...c,
      horses: c.horses.map((h) => {
        const before = entry.get(h.id)
        return before ? { ...h, ...before } : h
      }),
    }))
  }

  const clearPath = (id: string) =>
    editHorses((hs) =>
      hs.map((h) =>
        h.id === id ? { ...h, path: { v: 1, pts: [], sections: [] }, pending: null } : h,
      ),
    )
  /** Puts a changed horse (path, pending gap) back into the plan. */
  const replaceHorse = (horse: Horse) =>
    editHorses((hs) => hs.map((h) => (h.id === horse.id ? horse : h)))
  const removeHorse = (id: string) =>
    update((c) => ({ ...c, horses: c.horses.filter((h) => h.id !== id) }))

  return {
    // read-only views; changes only go through the actions below
    plan: computed(() => plan.value),
    role: computed(() => role.value),
    status,
    dirty,
    canEdit,
    peers: computed(() => peers.value),
    marks,
    load,
    close,
    flush,
    update,
    rename,
    setSettings,
    setTiming,
    setParts,
    addHorse,
    updateHorse,
    clearPath,
    replaceHorse,
    removeHorse,
    editHorses,
    undo,
    canUndo: computed(() => history.value.length > 0),
  }
})
