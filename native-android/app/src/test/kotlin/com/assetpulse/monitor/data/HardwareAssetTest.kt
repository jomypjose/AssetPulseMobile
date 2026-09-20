package com.assetpulse.monitor.data

import com.assetpulse.monitor.data.model.HardwareAsset
import com.assetpulse.monitor.data.model.HardwareListResponse
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class HardwareAssetTest {

    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
        isLenient = true
    }

    @Test
    fun `parses the paginated hardware envelope`() {
        val payload = """
            {"success":true,
             "data":[{"id":12,"item_id":"ESM-HW-0012","brand_name":"HP",
                      "model_name":"HP Laptop 15s-fq5111TU (6P129PA)",
                      "serial_number":"5CD2345XYZ","emp_name":"A Kumar"}],
             "pagination":{"page":1,"limit":25,"total":1,"totalPages":1}}
        """.trimIndent()

        val asset = json.decodeFromString<HardwareListResponse>(payload).data.single()
        assertEquals(12, asset.id)
        assertEquals("5CD2345XYZ", asset.serialNumber)
    }

    @Test
    fun `does not repeat a brand the model name already carries`() {
        val asset = HardwareAsset(
            id = 1,
            brandName = "HP",
            modelName = "HP Laptop 15s-fq5111TU (6P129PA)",
        )
        assertEquals("HP Laptop 15s-fq5111TU (6P129PA)", asset.displayName)
    }

    @Test
    fun `matches the brand prefix case insensitively`() {
        val asset = HardwareAsset(id = 1, brandName = "hp", modelName = "HP EliteBook 840")
        assertEquals("HP EliteBook 840", asset.displayName)
    }

    @Test
    fun `combines brand and model when they differ`() {
        val asset = HardwareAsset(id = 1, brandName = "Dell", modelName = "Latitude 5420")
        assertEquals("Dell Latitude 5420", asset.displayName)
    }

    @Test
    fun `falls back through model, brand, then item id`() {
        assertEquals("Latitude 5420", HardwareAsset(id = 1, modelName = "Latitude 5420").displayName)
        assertEquals("Dell", HardwareAsset(id = 1, brandName = "Dell").displayName)
        assertEquals("ESM-HW-0012", HardwareAsset(id = 1, itemId = "ESM-HW-0012").displayName)
        assertEquals("Asset 1", HardwareAsset(id = 1).displayName)
    }

    @Test
    fun `subtitle drops blank parts`() {
        val asset = HardwareAsset(
            id = 1,
            itemId = "ESM-HW-0012",
            serialNumber = "",
            empName = "A Kumar",
            branchName = null,
        )
        assertEquals("ESM-HW-0012 · A Kumar", asset.subtitle)
    }
}
