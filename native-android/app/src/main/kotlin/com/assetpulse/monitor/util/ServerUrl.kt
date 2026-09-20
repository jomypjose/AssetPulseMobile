package com.assetpulse.monitor.util

/**
 * Server address normalisation, ported verbatim from `normaliseUrl` in
 * `src/screens/ServerSetupScreen.js`.
 *
 * Always resolves to https://. Plain http:// is never honoured even when the
 * user types it explicitly: credentials and bearer tokens go to this address
 * on every request, and allowing cleartext would let a spoofed host on the
 * same network harvest a login. The app's network security config enforces
 * the same rule at the platform level.
 */
object ServerUrl {

    fun normalise(raw: String): String? {
        var url = raw.trim().trimEnd('/')
        if (url.isEmpty()) return null

        url = when {
            url.startsWith("http://", ignoreCase = true) ->
                "https://" + url.substring("http://".length)
            url.startsWith("https://", ignoreCase = true) -> url
            else -> "https://$url"
        }

        // Append /api unless the address already ends with it.
        if (!API_SUFFIX.containsMatchIn(url)) url = "$url/api"

        return url
    }

    /** True when the user typed a plaintext address that we silently upgraded. */
    fun wasPlaintext(raw: String): Boolean =
        raw.trim().startsWith("http://", ignoreCase = true)

    private val API_SUFFIX = Regex("/api/?$", RegexOption.IGNORE_CASE)
}
