package com.assetpulse.monitor.data.local

import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.time.Duration.Companion.milliseconds

/** A cached payload plus when it was taken. */
data class Cached<T>(val value: T, val cachedAt: Long)

/**
 * Read-through offline snapshot store — the native counterpart of
 * `src/services/OfflineCache.js`.
 *
 * Callers pass the serializer explicitly rather than this exposing reified
 * helpers, which would force the Json and DAO dependencies to be public.
 *
 * Best-effort throughout: every read and write swallows its own errors, so a
 * cache problem can never turn into a user-visible failure on a path that
 * would otherwise have worked.
 */
@Singleton
class OfflineCache @Inject constructor(
    private val dao: CacheDao,
    private val json: Json,
) {

    suspend fun <T> put(key: String, serializer: KSerializer<T>, value: T) {
        runCatching {
            dao.put(CacheEntry(key, json.encodeToString(serializer, value), System.currentTimeMillis()))
        }
    }

    suspend fun <T> get(key: String, serializer: KSerializer<T>): Cached<T>? = runCatching {
        val entry = dao.get(key) ?: return null
        Cached(json.decodeFromString(serializer, entry.json), entry.cachedAt)
    }.getOrNull()

    suspend fun clear() {
        runCatching { dao.clear() }
    }

    companion object {
        const val KEY_DEVICES = "devices"
        const val KEY_ALERTS = "alerts"

        /** "how stale is this snapshot", in the wording the RN app used. */
        fun formatStale(cachedAt: Long, now: Long = System.currentTimeMillis()): String {
            val minutes = (now - cachedAt).milliseconds.inWholeMinutes
            if (minutes < 1) return "just now"
            if (minutes < 60) return "${minutes}m ago"
            val hours = minutes / 60
            if (hours < 24) return "${hours}h ago"
            return "${hours / 24}d ago"
        }
    }
}
