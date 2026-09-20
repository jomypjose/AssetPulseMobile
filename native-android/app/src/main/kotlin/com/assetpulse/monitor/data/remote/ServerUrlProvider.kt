package com.assetpulse.monitor.data.remote

import javax.inject.Inject
import javax.inject.Singleton

/**
 * Holds the user-configured server address in memory so OkHttp interceptors
 * can read it synchronously.
 *
 * The RN app did the same thing by mutating `api.defaults.baseURL`
 * (`setApiBaseUrl` in src/services/api.js). There is no compile-time base URL:
 * the address is entered on the Server Setup screen at first run and persisted
 * in [com.assetpulse.monitor.data.local.AppPreferences].
 */
@Singleton
class ServerUrlProvider @Inject constructor() {

    @Volatile
    var baseUrl: String? = null
        private set

    fun set(url: String?) {
        baseUrl = url?.trim()?.trimEnd('/')?.takeIf { it.isNotEmpty() }
    }

    val isConfigured: Boolean get() = baseUrl != null
}
