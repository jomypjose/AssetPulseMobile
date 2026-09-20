package com.assetpulse.monitor.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * A hardware asset as returned by `GET /hardware` — used when choosing which
 * asset record this phone corresponds to during tracking enrollment.
 */
@Serializable
data class HardwareAsset(
    val id: Int,
    @SerialName("item_id") val itemId: String? = null,
    @SerialName("serial_number") val serialNumber: String? = null,
    @SerialName("brand_name") val brandName: String? = null,
    @SerialName("model_name") val modelName: String? = null,
    @SerialName("asset_type") val assetType: String? = null,
    @SerialName("asset_status") val assetStatus: String? = null,
    @SerialName("emp_name") val empName: String? = null,
    @SerialName("emp_code") val empCode: String? = null,
    @SerialName("branch_code") val branchCode: String? = null,
    @SerialName("branch_name") val branchName: String? = null,
    @SerialName("is_tracking_enabled") val isTrackingEnabled: Boolean? = null,
) {
    val displayName: String
        get() {
            val brand = brandName?.trim()?.takeIf { it.isNotBlank() }
            val model = modelName?.trim()?.takeIf { it.isNotBlank() }
            // Model names in this data often already carry the brand
            // ("HP" + "HP Laptop 15s" would read as "HP HP Laptop 15s").
            val name = when {
                brand == null -> model
                model == null -> brand
                model.startsWith(brand, ignoreCase = true) -> model
                else -> "$brand $model"
            }
            return name ?: itemId?.takeIf { it.isNotBlank() } ?: "Asset $id"
        }

    val subtitle: String
        get() = listOfNotNull(
            itemId?.takeIf { it.isNotBlank() },
            serialNumber?.takeIf { it.isNotBlank() },
            empName?.takeIf { it.isNotBlank() },
            branchName?.takeIf { it.isNotBlank() },
        ).joinToString(" · ")
}

/** `GET /hardware` is paginated: `{ success, data, pagination }`. */
@Serializable
data class HardwareListResponse(
    val data: List<HardwareAsset> = emptyList(),
)

@Serializable
data class ToggleTrackingRequest(
    @SerialName("is_tracking_enabled") val isTrackingEnabled: Boolean,
)

/** `POST /tracking/assets/{id}/token` → `{ success, token, asset }`. */
@Serializable
data class AgentTokenResponse(
    val token: String? = null,
    val asset: HardwareAsset? = null,
)
