package com.assetpulse.monitor.util

import java.util.Base64

/**
 * Minimal, signature-less JWT payload reader — the native equivalent of the
 * `decodeJwtExp` helper in `src/services/api.js`.
 *
 * Only `exp` is ever read, to decide whether to refresh proactively; the
 * server remains the sole authority on validity, so not verifying the
 * signature here is intentional and safe.
 *
 * Deliberately built on `java.util.Base64` (API 26+, which is our minSdk) and
 * a plain regex rather than `android.util.Base64`/`org.json`, so this stays
 * ordinary JVM code and is unit-testable without Robolectric or mocking.
 */
object Jwt {

    /** Treat a token as expiring if it has under this much life left. */
    private const val SKEW_MS = 60_000L

    private val EXP_FIELD = Regex("\"exp\"\\s*:\\s*(\\d+)")

    fun expiresAtMillis(token: String?): Long? {
        if (token.isNullOrBlank()) return null
        val parts = token.split('.')
        if (parts.size < 2) return null
        return runCatching {
            val payload = String(Base64.getUrlDecoder().decode(parts[1].padForBase64()))
            EXP_FIELD.find(payload)?.groupValues?.get(1)?.toLong()?.takeIf { it > 0 }?.times(1000L)
        }.getOrNull()
    }

    /**
     * True when the token is within [SKEW_MS] of expiring. A token whose
     * expiry we cannot read returns false, so an unfamiliar token shape does
     * not cause a refresh on every single request.
     */
    fun isExpiringSoon(token: String?, nowMillis: Long = System.currentTimeMillis()): Boolean {
        val expiresAt = expiresAtMillis(token) ?: return false
        return nowMillis >= expiresAt - SKEW_MS
    }

    /** JWT segments are unpadded base64url; the JDK decoder wants padding. */
    private fun String.padForBase64(): String = when (length % 4) {
        2 -> "$this=="
        3 -> "$this="
        else -> this
    }
}
