package com.assetpulse.monitor.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.SocketTimeoutException
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

sealed interface ProbeResult {
    data class Ok(val message: String) : ProbeResult
    data class Failed(val message: String) : ProbeResult
}

/**
 * Checks a candidate server address before it is saved.
 *
 * Deliberately standalone: this runs *before* a server is configured, so it
 * cannot use the main API client (whose [HostSelectionInterceptor] requires a
 * configured address). Mirrors ServerSetupScreen.js, which hit `/health` with
 * a bare axios call and an 8s timeout.
 */
@Singleton
class HealthProbe @Inject constructor() {

    private val client = OkHttpClient.Builder()
        .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .build()

    suspend fun check(normalisedUrl: String): ProbeResult = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$normalisedUrl/health")
            .header("X-Token-Transport", "body")
            .get()
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext ProbeResult.Failed("Server returned ${response.code}")
                }
                val healthy = runCatching {
                    JSONObject(response.body?.string().orEmpty()).optString("status") == "healthy"
                }.getOrDefault(false)
                ProbeResult.Ok(if (healthy) "Server is healthy ✓" else "Server responded ✓")
            }
        } catch (e: SocketTimeoutException) {
            ProbeResult.Failed("Connection timed out — check the address and port.")
        } catch (e: Exception) {
            ProbeResult.Failed("Could not reach server — check the address.")
        }
    }

    private companion object {
        const val TIMEOUT_SECONDS = 8L
    }
}
