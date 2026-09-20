package com.assetpulse.monitor.tracking

import android.content.Context

/**
 * Enrollment state for background asset tracking.
 *
 * Deliberately plain SharedPreferences rather than the app's DataStore: the
 * boot receiver and the service both need these values synchronously, before
 * any coroutine scope exists. The key names match the ones in
 * `agent/mobile/android-service-guide.md` so an MDM-provisioned device can
 * seed them without going through the app.
 *
 * The agent token identifies one hardware asset to the server. It is not a
 * user credential — it grants only the ability to POST telemetry for that
 * asset — so it does not belong in the encrypted token store next to the
 * session JWTs.
 */
class TrackingPreferences(context: Context) {

    private val prefs = context.applicationContext
        .getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)

    var serverUrl: String?
        get() = prefs.getString(KEY_SERVER_URL, null)
        set(value) = prefs.edit().putString(KEY_SERVER_URL, value).apply()

    var agentToken: String?
        get() = prefs.getString(KEY_AGENT_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_AGENT_TOKEN, value).apply()

    var serialNumber: String?
        get() = prefs.getString(KEY_SERIAL, null)
        set(value) = prefs.edit().putString(KEY_SERIAL, value).apply()

    var intervalMs: Long
        get() = prefs.getLong(KEY_INTERVAL, DEFAULT_INTERVAL_MS)
        set(value) = prefs.edit().putLong(KEY_INTERVAL, value).apply()

    /** What the enrolled asset is called, for display only. */
    var assetLabel: String?
        get() = prefs.getString(KEY_ASSET_LABEL, null)
        set(value) = prefs.edit().putString(KEY_ASSET_LABEL, value).apply()

    var assetId: Int
        get() = prefs.getInt(KEY_ASSET_ID, -1)
        set(value) = prefs.edit().putInt(KEY_ASSET_ID, value).apply()

    /** True once the user has explicitly turned tracking on. */
    var enabled: Boolean
        get() = prefs.getBoolean(KEY_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_ENABLED, value).apply()

    val isEnrolled: Boolean
        get() = !serverUrl.isNullOrBlank() && !agentToken.isNullOrBlank()

    fun save(
        serverUrl: String,
        agentToken: String,
        serialNumber: String?,
        assetId: Int,
        assetLabel: String?,
        intervalMs: Long = DEFAULT_INTERVAL_MS,
    ) {
        prefs.edit()
            .putString(KEY_SERVER_URL, serverUrl)
            .putString(KEY_AGENT_TOKEN, agentToken)
            .putString(KEY_SERIAL, serialNumber)
            .putInt(KEY_ASSET_ID, assetId)
            .putString(KEY_ASSET_LABEL, assetLabel)
            .putLong(KEY_INTERVAL, intervalMs)
            .putBoolean(KEY_ENABLED, true)
            .apply()
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    companion object {
        const val FILE_NAME = "assetpulse_tracking_prefs"
        const val DEFAULT_INTERVAL_MS = 600_000L // 10 minutes, per the guide

        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_AGENT_TOKEN = "agent_token"
        private const val KEY_SERIAL = "serial_number"
        private const val KEY_INTERVAL = "interval_ms"
        private const val KEY_ASSET_ID = "asset_id"
        private const val KEY_ASSET_LABEL = "asset_label"
        private const val KEY_ENABLED = "enabled"

        /**
         * The app stores its server address already including the `/api`
         * prefix (ServerSetupScreen appends it), while the guide's snippet
         * assumes a bare origin and appends `/api/...` itself. Joining those
         * naively yields `/api/api/tracking/...`, so the prefix is collapsed
         * here.
         */
        fun pingUrl(serverUrl: String): String {
            val base = serverUrl.trim().trimEnd('/')
            val origin = if (base.endsWith("/api", ignoreCase = true)) {
                base.removeSuffix("/api").removeSuffix("/API")
            } else {
                base
            }
            return "$origin/api/tracking/agent/ping"
        }
    }
}
