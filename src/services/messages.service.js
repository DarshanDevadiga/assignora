import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase.js'

const REALTIME_CHANNEL = 'assignora-realtime'
let globalChannel = null
const memoryStore = new Map()
const busListeners = new Set()

/**
 * Robust message reconciliation and deduplication engine.
 * Guarantees that:
 * 1. Duplicate database message IDs are never appended twice.
 * 2. Optimistic temporary messages (e.g. `opt-*` or `temp-*`) are reconciled and replaced
 *    by the canonical persisted database record once it arrives via RPC return or Realtime event.
 * 3. Concurrent fetch and Realtime events are merged safely without duplicate rows.
 * 4. Chronological sort order by created_at is strictly preserved.
 */
export function reconcileAndDeduplicateMessages(previousMessages = [], incoming = []) {
  const incomingArr = Array.isArray(incoming) ? incoming : [incoming].filter(Boolean)
  if (incomingArr.length === 0) return previousMessages

  const map = new Map()

  // 1. Seed existing messages by ID
  for (const m of previousMessages) {
    if (m?.id) {
      map.set(String(m.id), m)
    }
  }

  // 2. Reconcile and merge incoming messages
  for (const inc of incomingArr) {
    if (!inc || !inc.id) continue
    const incId = String(inc.id)

    // Check if incoming is a persisted canonical DB ID
    const isPersisted = !incId.startsWith('opt-') && !incId.startsWith('temp-') && !incId.startsWith('msg-')

    if (isPersisted) {
      // Look for a matching temporary optimistic message (same senderId and same text within 30s)
      let matchedTempId = null
      for (const [key, existing] of map.entries()) {
        const isExistingTemp = key.startsWith('opt-') || key.startsWith('temp-') || key.startsWith('msg-')
        if (
          isExistingTemp &&
          existing.senderId === inc.senderId &&
          existing.text?.trim() === inc.text?.trim()
        ) {
          const tExisting = new Date(existing.createdAt || existing.created_at || Date.now()).getTime()
          const tInc = new Date(inc.createdAt || inc.created_at || Date.now()).getTime()
          if (Math.abs(tExisting - tInc) < 30000) {
            matchedTempId = key
            break
          }
        }
      }

      if (matchedTempId) {
        map.delete(matchedTempId) // safely remove the transient optimistic message
      }
    }

    // Merge or insert incoming record
    const existing = map.get(incId)
    if (existing) {
      map.set(incId, {
        ...existing,
        ...inc,
        senderName:
          inc.senderName && inc.senderName !== 'Member' && inc.senderName !== 'Class Member'
            ? inc.senderName
            : existing.senderName || inc.senderName || 'Member',
        senderAvatar: inc.senderAvatar || existing.senderAvatar || null,
        senderRole: inc.senderRole || existing.senderRole || 'student',
      })
    } else {
      map.set(incId, inc)
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at)
  )
}

/**
 * Deduplicate and append a message by its unique database ID
 */
export function addMessageOnce(previousMessages = [], newMessage) {
  if (!newMessage || !newMessage.id) return previousMessages
  return reconcileAndDeduplicateMessages(previousMessages, [newMessage])
}

/**
 * Add a new message or update existing message by ID
 */
export function addOrUpdateMessage(previousMessages = [], newMessage) {
  if (!newMessage || !newMessage.id) return previousMessages
  return reconcileAndDeduplicateMessages(previousMessages, [newMessage])
}

/**
 * Merge and deduplicate an array of incoming messages into an existing message array,
 * preserving chronological order by created_at
 */
export function mergeMessages(previousMessages = [], incomingMessages = []) {
  return reconcileAndDeduplicateMessages(previousMessages, incomingMessages)
}

export const messagesService = {
  addMessageOnce,
  addOrUpdateMessage,
  mergeMessages,
  /**
   * Initialize or retrieve the global Supabase Realtime channel
   */
  getChannel() {
    const existing = supabase.getChannels().find((c) => c.topic === `realtime:${REALTIME_CHANNEL}`)
    if (existing) {
      return existing
    }
    if (!globalChannel) {
      globalChannel = supabase.channel(REALTIME_CHANNEL, {
        config: {
          broadcast: { self: true },
        },
      })
      globalChannel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[messagesService] Realtime channel connected.')
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('[messagesService] Channel error:', err)
        }
      })
    }
    return globalChannel
  },

  /**
   * Broadcast an event over the realtime channel and notify bus listeners
   */
  async broadcast(event, payload) {
    // 1. Notify in-memory listeners immediately
    busListeners.forEach((fn) => {
      try {
        fn({ event, payload })
      } catch (e) {
        console.warn('[messagesService] bus listener error:', e)
      }
    })

    // 2. Broadcast over global realtime channel for notifications & counters
    try {
      const ch = this.getChannel()
      await ch.send({
        type: 'broadcast',
        event,
        payload,
      })
    } catch (err) {
      console.warn('[messagesService] Global broadcast failed:', err)
    }

    // 3. If payload has classId, also broadcast to the class-specific channel
    if (payload?.classId) {
      try {
        const classTopic = `class-discussion:${payload.classId}`
        const existingClassCh = supabase.getChannels().find((c) => c.topic === `realtime:${classTopic}`)
        if (existingClassCh) {
          await existingClassCh.send({
            type: 'broadcast',
            event,
            payload,
          })
        }
      } catch (err) {
        console.warn('[messagesService] Class broadcast failed:', err)
      }
    }
  },

  /**
   * Subscribe to in-memory broadcast events with safe cleanup
   */
  subscribe(callback) {
    busListeners.add(callback)
    return () => {
      busListeners.delete(callback)
    }
  },

  /**
   * Retrieve all messages/discussion for a given class
   */
  async getClassMessages(classId) {
    if (!classId) return []

    // 1. Try querying dedicated class_messages table first
    try {
      const { data: msgRows, error: msgErr } = await supabase
        .from('class_messages')
        .select(`
          id,
          class_id,
          sender_id,
          message,
          created_at,
          users:sender_id (id, name, email, avatar, role)
        `)
        .eq('class_id', classId)
        .order('created_at', { ascending: true })

      if (!msgErr && msgRows) {
        return msgRows.map((r) => ({
          id: r.id,
          classId: r.class_id,
          senderId: r.sender_id,
          senderName: r.users?.name || 'Class Member',
          senderRole: r.users?.role || 'student',
          senderAvatar: r.users?.avatar || null,
          text: r.message,
          createdAt: r.created_at,
          isDiscussion: true,
        }))
      }
    } catch (e) {
      console.warn('[messagesService] Error querying class_messages:', e)
    }

    // 2. Fallback to announcements table if class_messages is not yet migrated
    const { data, error } = await supabase
      .from('announcements')
      .select(`
        id,
        title,
        message,
        admin_id,
        class_id,
        created_at
      `)
      .eq('class_id', classId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[messagesService] Error fetching class messages fallback:', error)
      return []
    }

    return (data || []).map((row) => {
      let parsed = null
      if (row.message && row.message.trim().startsWith('{')) {
        try {
          parsed = JSON.parse(row.message)
        } catch {
          // not json
        }
      }

      const isDiscussion = row.title.startsWith('[Discussion]') || Boolean(parsed)

      return {
        id: row.id,
        classId: row.class_id,
        senderId: parsed?.sender_id || row.admin_id,
        senderName: parsed?.sender_name || (row.title.replace(/^\[Discussion\]\s*/, '') || 'Instructor'),
        senderRole: parsed?.sender_role || 'admin',
        senderAvatar: parsed?.sender_avatar || null,
        text: parsed?.text || row.message,
        title: row.title,
        isDiscussion,
        createdAt: row.created_at,
      }
    })
  },

  /**
   * Send a new message in a class discussion thread
   * Strictly preserves current authenticated user identity (no admin account switching)
   */
  async sendMessage({ classId, senderId, senderName, senderRole, senderAvatar = '', text }) {
    if (!classId || !text?.trim() || !senderId) {
      throw new Error('Class ID, Sender ID, and message text are required.')
    }

    const trimmedText = text.trim()
    let savedMessage = null

    // 1. Primary path: Insert into dedicated class_messages table
    try {
      const { data: newRow, error: insertError } = await supabase
        .from('class_messages')
        .insert({
          class_id: classId,
          sender_id: senderId,
          message: trimmedText,
        })
        .select(`
          id,
          class_id,
          sender_id,
          message,
          created_at,
          users:sender_id (id, name, email, avatar, role)
        `)
        .maybeSingle()

      if (!insertError && newRow) {
        savedMessage = {
          id: newRow.id,
          classId: newRow.class_id,
          senderId: newRow.sender_id,
          senderName: newRow.users?.name || senderName || 'Member',
          senderRole: newRow.users?.role || senderRole || 'student',
          senderAvatar: newRow.users?.avatar || senderAvatar,
          text: newRow.message,
          createdAt: newRow.created_at,
          isDiscussion: true,
        }
      } else if (insertError) {
        console.warn('[messagesService] class_messages insert returned error:', insertError.message)
      }
    } catch (err) {
      console.warn('[messagesService] class_messages insert exception:', err)
    }

    // 2. Fallback path: If class_messages not yet created in DB
    if (!savedMessage) {
      if (senderRole === 'admin') {
        const payload = JSON.stringify({
          sender_id: senderId,
          sender_name: senderName || 'Instructor',
          sender_role: 'admin',
          sender_avatar: senderAvatar || '',
          text: trimmedText,
        })
        const title = `[Discussion] ${senderName || 'Instructor'}`

        const { data: adminRow } = await supabase
          .from('announcements')
          .insert({
            title,
            message: payload,
            admin_id: senderId,
            class_id: classId,
            is_published: true,
          })
          .select()
          .maybeSingle()

        if (adminRow) {
          savedMessage = {
            id: adminRow.id,
            classId: adminRow.class_id,
            senderId,
            senderName,
            senderRole: 'admin',
            senderAvatar,
            text: trimmedText,
            createdAt: adminRow.created_at,
            isDiscussion: true,
          }
        }
      }

      // If student or admin insert fallback is needed, construct message object
      // NEVER authenticate as admin demo user! That violates session security!
      if (!savedMessage) {
        savedMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          classId,
          senderId,
          senderName: senderName || 'Student',
          senderRole: senderRole || 'student',
          senderAvatar: senderAvatar || '',
          text: trimmedText,
          createdAt: new Date().toISOString(),
          isDiscussion: true,
        }
      }
    }

    // 3. Mark as read immediately for sender
    this.markClassAsRead(classId, senderId)

    // 4. Broadcast message over realtime channel to connected peers
    await this.broadcast('class-message', {
      classId,
      message: savedMessage,
      senderId,
    })

    return savedMessage
  },

  /**
   * Get timestamp of when the user last read messages in this class
   */
  getLastReadTimestamp(classId, userId) {
    if (!classId || !userId) return null
    const key = `assignora_read_${userId}_${classId}`
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(key) || null
      } catch {
        // fallback to memoryStore
      }
    }
    return memoryStore.get(key) || null
  },

  /**
   * Mark all messages in a class as read for this user
   */
  markClassAsRead(classId, userId) {
    if (!classId || !userId) return
    const key = `assignora_read_${userId}_${classId}`
    const now = new Date().toISOString()

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, now)
      } catch {
        // fallback
      }
    }
    memoryStore.set(key, now)

    // Broadcast read receipt so sidebar and counters update in real-time
    this.broadcast('messages-read', {
      classId,
      userId,
      readAt: now,
    })
  },

  /**
   * Calculate unread messages count for a specific class
   * Rule: Only count messages the user has not read, and do NOT count the user's own messages!
   */
  getUnreadCount(classId, userId, messages = []) {
    if (!classId || !userId || !messages.length) return 0

    const lastRead = this.getLastReadTimestamp(classId, userId)

    const unread = messages.filter((m) => {
      // Do not count the user's own messages
      if (m.senderId === userId) return false

      if (!lastRead) return true
      return new Date(m.createdAt) > new Date(lastRead)
    })

    return unread.length
  },
}
