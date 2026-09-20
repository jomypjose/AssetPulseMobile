package com.assetpulse.monitor.data.repository

import android.content.Context
import com.assetpulse.monitor.data.local.AppPreferences
import com.assetpulse.monitor.data.model.HardwareAsset
import com.assetpulse.monitor.data.model.ToggleTrackingRequest
import com.assetpulse.monitor.data.remote.ApiException
import com.assetpulse.monitor.data.remote.AssetPulseApi
import com.assetpulse.monitor.data.remote.toApiException
import com.assetpulse.monitor.tracking.LocationTrackingService
import com.assetpulse.monitor.tracking.TrackingPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/** What this device is currently enrolled as, if anything. */
data class TrackingEnrollment(
    val enabled: Boolean,
    val assetId: Int,
    val assetLabel: String?,
    val serialNumber: String?,
    val intervalMs: Long,
)

/**
 * Enrollment and lifecycle for background asset tracking.
 *
 * The reference guide has the installer paste a server URL and agent token by
 * hand. This app is already signed in against that server, so it provisions
 * the token itself: pick the asset record, enable tracking on it, ask the
 * server for a token, store it, start the service.
 */
@Singleton
class TrackingRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: AssetPulseApi,
    private val appPreferences: AppPreferences,
) {
    private val prefs = TrackingPreferences(context)

    fun currentEnrollment(): TrackingEnrollment = TrackingEnrollment(
        enabled = prefs.enabled && prefs.isEnrolled,
        assetId = prefs.assetId,
        assetLabel = prefs.assetLabel,
        serialNumber = prefs.serialNumber,
        intervalMs = prefs.intervalMs,
    )

    suspend fun searchAssets(query: String): List<HardwareAsset> = withContext(Dispatchers.IO) {
        try {
            api.searchHardware(search = query.trim().ifBlank { null }).data
        } catch (e: Exception) {
            throw e.toApiException()
        }
    }

    /**
     * Enrolls this device as [asset] and starts reporting.
     *
     * Tracking is enabled on the asset first: the server only exposes
     * tracking-enabled assets on the map, so a token without the toggle would
     * produce pings nobody can see.
     */
    suspend fun enrollAndStart(asset: HardwareAsset, intervalMs: Long) = withContext(Dispatchers.IO) {
        val serverUrl = appPreferences.currentServerUrl()
            ?: throw ApiException("No server is configured.")

        try {
            api.toggleAssetTracking(asset.id, ToggleTrackingRequest(isTrackingEnabled = true))
        } catch (e: Exception) {
            throw e.toApiException()
        }

        val token = try {
            api.generateAgentToken(asset.id).token
        } catch (e: Exception) {
            throw e.toApiException()
        }

        if (token.isNullOrBlank()) {
            throw ApiException("The server did not return an agent token for this asset.")
        }

        prefs.save(
            serverUrl = serverUrl,
            agentToken = token,
            // Build.SERIAL is unreadable from API 26 on, so the asset's own
            // recorded serial is what identifies this device to the server.
            serialNumber = asset.serialNumber,
            assetId = asset.id,
            assetLabel = asset.displayName,
            intervalMs = intervalMs,
        )

        startService()
    }

    /** Re-enroll with a token issued elsewhere (read-only accounts, MDM). */
    suspend fun enrollWithToken(
        token: String,
        label: String?,
        intervalMs: Long,
    ) = withContext(Dispatchers.IO) {
        val serverUrl = appPreferences.currentServerUrl()
            ?: throw ApiException("No server is configured.")

        prefs.save(
            serverUrl = serverUrl,
            agentToken = token.trim(),
            serialNumber = null,
            assetId = -1,
            assetLabel = label,
            intervalMs = intervalMs,
        )
        startService()
    }

    fun startService() {
        if (!prefs.isEnrolled) return
        prefs.enabled = true
        LocationTrackingService.start(
            context = context,
            serverUrl = prefs.serverUrl.orEmpty(),
            agentToken = prefs.agentToken.orEmpty(),
            serialNumber = prefs.serialNumber,
            intervalMs = prefs.intervalMs,
        )
    }

    /** Stops reporting but keeps the enrollment, so it can be resumed. */
    fun stopTracking() {
        prefs.enabled = false
        LocationTrackingService.stop(context)
    }

    /** Stops reporting and forgets the agent token entirely. */
    fun unenroll() {
        LocationTrackingService.stop(context)
        prefs.clear()
    }
}
