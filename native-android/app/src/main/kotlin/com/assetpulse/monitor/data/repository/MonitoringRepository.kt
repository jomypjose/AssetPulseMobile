package com.assetpulse.monitor.data.repository

import com.assetpulse.monitor.data.local.OfflineCache
import com.assetpulse.monitor.data.model.AcknowledgeRequest
import com.assetpulse.monitor.data.model.Alert
import com.assetpulse.monitor.data.model.DashboardStats
import com.assetpulse.monitor.data.model.Device
import com.assetpulse.monitor.data.model.MaintenanceRequest
import com.assetpulse.monitor.data.remote.AssetPulseApi
import com.assetpulse.monitor.data.remote.toApiException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import javax.inject.Inject
import javax.inject.Singleton

/**
 * A list plus, when the network failed and we fell back to disk, how old the
 * snapshot is. `staleSince == null` means this is live data.
 */
data class Snapshot<T>(
    val value: T,
    val staleSince: Long? = null,
) {
    val isFromCache: Boolean get() = staleSince != null
}

/** Devices, alerts and dashboard stats. */
@Singleton
class MonitoringRepository @Inject constructor(
    private val api: AssetPulseApi,
    private val cache: OfflineCache,
    private val json: Json,
) {

    /**
     * Monitored devices only. `/network` returns every network asset and has
     * no "monitored only" filter, so the client filters on
     * `enable_monitoring` — same as the RN implementation.
     *
     * On failure, falls back to the last snapshot rather than surfacing an
     * error, so the list still renders something useful offline.
     */
    suspend fun getDevices(): Snapshot<List<Device>> = withContext(Dispatchers.IO) {
        try {
            val devices = api.getDevices().data.filter { it.enableMonitoring == true }
            cache.put(OfflineCache.KEY_DEVICES, ListSerializer(Device.serializer()), devices)
            Snapshot(devices)
        } catch (e: Exception) {
            val cached = cache.get(OfflineCache.KEY_DEVICES, ListSerializer(Device.serializer()))
                ?: throw e.toApiException()
            Snapshot(cached.value, staleSince = cached.cachedAt)
        }
    }

    suspend fun getDeviceDetail(id: Int): Device = withContext(Dispatchers.IO) {
        try {
            api.getDeviceDetail(id).device ?: throw IllegalStateException("Device not found")
        } catch (e: Exception) {
            throw e.toApiException()
        }
    }

    /**
     * Sparkline series. The server's metrics shape varies by version, so this
     * accepts all the forms the RN screen handled: a flat array, a
     * `*_history` array, or a `points: [{cpu, memory, ...}]` list.
     */
    suspend fun getDeviceMetrics(id: Int, range: String = "1h"): DeviceMetrics =
        withContext(Dispatchers.IO) {
            val raw = runCatching { api.getDeviceMetrics(id, range) }.getOrNull()
                ?: return@withContext DeviceMetrics()
            val obj = raw as? JsonObject ?: return@withContext DeviceMetrics()
            DeviceMetrics(
                cpu = obj.series("cpu_history", "cpu", pointKey = "cpu"),
                memory = obj.series("memory_history", "memory", pointKey = "memory"),
            )
        }

    suspend fun setMaintenanceMode(id: Int, enabled: Boolean) = withContext(Dispatchers.IO) {
        try {
            api.setMaintenanceMode(id, MaintenanceRequest(enabled))
        } catch (e: Exception) {
            throw e.toApiException()
        }
    }

    suspend fun getAlerts(severity: String? = null): Snapshot<List<Alert>> =
        withContext(Dispatchers.IO) {
            try {
                val alerts = api.getAlerts(severity).alerts
                // Only the unfiltered list is worth caching as "the" snapshot.
                if (severity == null) cache.put(OfflineCache.KEY_ALERTS, ListSerializer(Alert.serializer()), alerts)
                Snapshot(alerts)
            } catch (e: Exception) {
                val cached = cache.get(OfflineCache.KEY_ALERTS, ListSerializer(Alert.serializer()))
                    ?: throw e.toApiException()
                Snapshot(cached.value, staleSince = cached.cachedAt)
            }
        }

    suspend fun acknowledgeAlerts(ids: List<Int>) = withContext(Dispatchers.IO) {
        if (ids.isEmpty()) return@withContext
        try {
            api.acknowledgeAlerts(AcknowledgeRequest(ids = ids, alertIds = ids))
        } catch (e: Exception) {
            throw e.toApiException()
        }
    }

    suspend fun getDashboardStats(): DashboardStats = withContext(Dispatchers.IO) {
        try {
            api.getDashboardStats()
        } catch (e: Exception) {
            throw e.toApiException()
        }
    }

    /** Pulls a numeric series out of whichever shape the server used. */
    private fun JsonObject.series(vararg directKeys: String, pointKey: String): List<Float> {
        directKeys.forEach { key ->
            (this[key] as? JsonArray)?.let { array ->
                return array.mapNotNull { it.jsonPrimitive.doubleOrNull?.toFloat() }
            }
        }
        val points = this["points"] as? JsonArray ?: return emptyList()
        return points.mapNotNull { point ->
            (point as? JsonObject)?.get(pointKey)?.jsonPrimitive?.doubleOrNull?.toFloat()
        }
    }
}

data class DeviceMetrics(
    val cpu: List<Float> = emptyList(),
    val memory: List<Float> = emptyList(),
) {
    val hasAny: Boolean get() = cpu.isNotEmpty() || memory.isNotEmpty()
}
