package com.assetpulse.monitor.data.model

import kotlinx.serialization.SerialName

import kotlinx.serialization.Serializable

/** Live status as the backend reports it on a monitored network device. */
enum class DeviceStatus { ONLINE, WARNING, OFFLINE, UNKNOWN;

    companion object {
        fun from(raw: String?): DeviceStatus = when (raw?.lowercase()) {
            "online" -> ONLINE
            "warning" -> WARNING
            "offline" -> OFFLINE
            else -> UNKNOWN
        }
    }

    val label: String
        get() = when (this) {
            ONLINE -> "Online"
            WARNING -> "Warning"
            OFFLINE -> "Offline"
            UNKNOWN -> "Unknown"
        }
}

@Serializable
data class DeviceExtra(
    @SerialName("cpu_count") val cpuCount: Int? = null,
    @SerialName("memory_used")
    @Serializable(with = LenientLongSerializer::class) val memoryUsed: Long? = null,
    @SerialName("memory_total")
    @Serializable(with = LenientLongSerializer::class) val memoryTotal: Long? = null,
)

@Serializable
data class Device(
    val id: Int,
    val hostname: String? = null,
    @SerialName("sys_name") val sysName: String? = null,
    @SerialName("sys_location") val sysLocation: String? = null,
    @SerialName("ip_address") val ipAddress: String? = null,
    @SerialName("monitoring_status") val monitoringStatus: String? = null,
    @SerialName("enable_monitoring") val enableMonitoring: Boolean? = null,
    @SerialName("maintenance_mode") val maintenanceMode: Boolean? = null,
    @SerialName("cpu_usage")
    @Serializable(with = LenientDoubleSerializer::class) val cpuUsage: Double? = null,
    @SerialName("memory_used")
    @Serializable(with = LenientLongSerializer::class) val memoryUsed: Long? = null,
    @SerialName("memory_total")
    @Serializable(with = LenientLongSerializer::class) val memoryTotal: Long? = null,
    @Serializable(with = LenientDoubleSerializer::class) val latency: Double? = null,
    @SerialName("last_seen") val lastSeen: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
    // Already human-formatted by the server, e.g. "53d 9h 12m 44s".
    @SerialName("snmp_uptime") val snmpUptime: String? = null,
    @SerialName("branch_code") val branchCode: String? = null,
    val extra: DeviceExtra? = null,
) {
    val status: DeviceStatus get() = DeviceStatus.from(monitoringStatus)

    /** Best available display name, in the order the RN list used them. */
    val displayName: String
        get() = hostname?.takeIf { it.isNotBlank() }
            ?: sysName?.takeIf { it.isNotBlank() }
            ?: ipAddress?.takeIf { it.isNotBlank() }
            ?: "Device $id"

    val cpuPercent: Int? get() = cpuUsage?.let { Math.round(it).toInt() }

    /** Memory percentage, preferring the richer `extra` block from /detail. */
    val memoryPercent: Int?
        get() {
            val used = extra?.memoryUsed ?: memoryUsed
            val total = extra?.memoryTotal ?: memoryTotal
            if (used == null || total == null || total <= 0L) return null
            return ((used.toDouble() / total.toDouble()) * 100).toInt()
        }
}

@Serializable
data class DeviceListResponse(
    val data: List<Device> = emptyList(),
)

@Serializable
data class DeviceDetailResponse(
    val device: Device? = null,
)

/**
 * The device an alert was raised against. `/alerts` embeds this as an object
 * (not a name string), and the RN detail sheet read `sys_name`, `ip_address`,
 * `category` and `branch_name` off it.
 */
@Serializable
data class AlertNetworkAsset(
    val id: Int? = null,
    @SerialName("item_id") val itemId: String? = null,
    @SerialName("sys_name") val sysName: String? = null,
    @SerialName("ip_address") val ipAddress: String? = null,
    val category: String? = null,
    @SerialName("branch_name") val branchName: String? = null,
)

@Serializable
data class Alert(
    val id: Int,
    val severity: String? = null,
    val status: String? = null,
    val message: String? = null,
    val metric: String? = null,
    val category: String? = null,
    val type: String? = null,
    @SerialName("device_name") val deviceName: String? = null,
    @SerialName("device_ip") val deviceIp: String? = null,
    @SerialName("branch_name") val branchName: String? = null,
    @SerialName("network_asset") val networkAsset: AlertNetworkAsset? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("resolved_at") val resolvedAt: String? = null,
) {
    /**
     * The API has no `is_acknowledged` field; the RN client derived it from
     * `status` and every screen relied on that, so the rule lives here.
     */
    val isAcknowledged: Boolean
        get() = status == "acknowledged" || status == "resolved"

    val severityKey: String get() = severity?.lowercase() ?: "unknown"

    /** Device label, preferring the embedded asset over the flat columns. */
    val deviceLabel: String?
        get() = deviceName?.takeIf { it.isNotBlank() }
            ?: networkAsset?.sysName?.takeIf { it.isNotBlank() }
            ?: networkAsset?.itemId?.takeIf { it.isNotBlank() }

    val deviceAddress: String?
        get() = deviceIp?.takeIf { it.isNotBlank() }
            ?: networkAsset?.ipAddress?.takeIf { it.isNotBlank() }

    val branchLabel: String?
        get() = branchName?.takeIf { it.isNotBlank() }
            ?: networkAsset?.branchName?.takeIf { it.isNotBlank() }
}

@Serializable
data class AlertsResponse(
    val alerts: List<Alert> = emptyList(),
)

@Serializable
data class MonitoringStats(
    val total: Int = 0,
    val online: Int = 0,
    val offline: Int = 0,
    val warning: Int = 0,
)

@Serializable
data class TicketStats(
    val pending: Int = 0,
)

@Serializable
data class DashboardStats(
    val monitoring: MonitoringStats = MonitoringStats(),
    val tickets: TicketStats = TicketStats(),
)

@Serializable
data class MaintenanceRequest(
    @SerialName("maintenance_mode") val maintenanceMode: Boolean,
)

@Serializable
data class AcknowledgeRequest(
    // The server accepts either key; the RN client sent both and so do we.
    val ids: List<Int>,
    @SerialName("alert_ids") val alertIds: List<Int>,
)
