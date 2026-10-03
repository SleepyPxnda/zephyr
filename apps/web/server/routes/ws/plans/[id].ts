import { planRoleOf } from '../../../lib/access'
import { handle, join, leave, type LiveContext } from '../../../lib/live'
import { findActiveUser, sessionUser } from '../../../utils/auth'

const reject = (status: number, text: string) => new Response(text, { status })

/**
 * Live editing of one plan (SPEC "Speichern und Konflikte"): authenticated at the upgrade, the
 * role is looked up like for the REST routes (no access: 404, never reveals the plan).
 */
export default defineWebSocketHandler({
  async upgrade(request) {
    // a browser always sends Origin on a WebSocket handshake: only our own pages may connect
    const origin = request.headers.get('origin')
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    if (!origin || !host || new URL(origin).host !== host) throw reject(403, 'forbidden')

    const planId = new URL(request.url, 'http://localhost').pathname.split('/').at(-1) ?? ''
    const session = await getUserSession(request as never)
    const userId = session.user?.id
    if (!userId) throw reject(401, 'unauthenticated')
    const user = await findActiveUser(userId)
    if (!user) throw reject(401, 'unauthenticated')
    const role = await planRoleOf(useDb(), user.id, planId)
    if (!role) throw reject(404, 'not found')

    const ctx: LiveContext = {
      planId,
      userId: user.id,
      name: user.name || user.username,
      avatarUrl: sessionUser(user).avatarUrl ?? null,
      role,
    }
    Object.assign(request.context, ctx)
  },
  open: (peer) => join(peer),
  message: (peer, message) => handle(peer, message.text()),
  close: (peer) => leave(peer),
  error: (peer, error) => console.error('[live] socket error', peer.id, error),
})
