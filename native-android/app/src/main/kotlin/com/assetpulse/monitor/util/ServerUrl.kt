package com.assetpulse.monitor.util

import com.assetpulse.monitor.BuildConfig

/**
 * Server address normalisation, ported from `normaliseUrl` in
 * `src/screens/ServerSetupScreen.js`.
 *
 * Release builds always resolve to https://. Plain http:// is not honoured
 * even when typed: credentials and bearer tokens go to this address on every
 * request, and allowing cleartext would let a spoofed host on the same
 * network harvest a login. The network security config enforces the same rule
 * at the platform level.
 *
 * Debug builds keep http:// as typed, because local development servers have
 * no TLS (the AssetPulse API dev server runs on :3001 over plain HTTP). That
 * relaxation is confined to the debug variant — see
 * `src/debug/res/xml/network_security_config.xml`.
 */
object ServerUrl {

    fun normalise(raw: String, allowCleartext: Boolean = BuildConfig.DEBUG): String? {
        var url = raw.trim().trimEnd('/')
        if (url.isEmpty()) return null

        val typedPlaintext = url.startsWith("http://", ignoreCase = true)

        url = when {
            typedPlaintext && allowCleartext -> url
            typedPlaintext -> "https://" + url.substring("http://".length)
            url.startsWith("https://", ignoreCase = true) -> url
            else -> "https://$url"
        }

        // Append /api unless the address already ends with it.
        if (!API_SUFFIX.containsMatchIn(url)) url = "$url/api"

        return url
    }

    /**
     * True when the user typed a plaintext address that we silently upgraded.
     * Only meaningful when cleartext is disallowed, i.e. in release builds.
     */
    fun wasPlaintext(raw: String, allowCleartext: Boolean = BuildConfig.DEBUG): Boolean =
        !allowCleartext && raw.trim().startsWith("http://", ignoreCase = true)

    private val API_SUFFIX = Regex("/api/?$", RegexOption.IGNORE_CASE)
}
