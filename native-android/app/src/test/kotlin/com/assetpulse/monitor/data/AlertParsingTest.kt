package com.assetpulse.monitor.data

import com.assetpulse.monitor.data.model.AlertsResponse
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regression tests for the `/alerts` payload.
 *
 * `network_asset` was first modelled as a string, which made the real
 * response throw `JsonDecodingException` and take the process down on the
 * Dashboard. These pin the actual server shape.
 */
class AlertParsingTest {

    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
        isLenient = true
    }

    @Test
    fun `parses an alert whose network_asset is an embedded object`() {
        val payload = """
            {"alerts":[{
              "id": 1204,
              "severity": "critical",
              "status": "open",
              "message": "Device unreachable",
              "metric": "availability",
              "created_at": "2026-09-20T13:18:08.292Z",
              "network_asset": {
                "id": 570,
                "item_id": "ESM-NW-05",
                "sys_name": "branch-switch-05",
                "ip_address": "10.4.2.5",
                "category": "Switch",
                "branch_name": "Ernakulam South"
              }
            }]}
        """.trimIndent()

        val alert = json.decodeFromString<AlertsResponse>(payload).alerts.single()

        assertEquals(1204, alert.id)
        assertEquals("branch-switch-05", alert.networkAsset?.sysName)
        assertEquals("10.4.2.5", alert.networkAsset?.ipAddress)
        assertEquals("Ernakulam South", alert.networkAsset?.branchName)
    }

    @Test
    fun `display fields fall back to the embedded asset`() {
        val payload = """
            {"alerts":[{
              "id": 7,
              "severity": "warning",
              "network_asset": {
                "sys_name": "core-01",
                "ip_address": "10.0.0.1",
                "branch_name": "HQ"
              }
            }]}
        """.trimIndent()

        val alert = json.decodeFromString<AlertsResponse>(payload).alerts.single()

        assertEquals("core-01", alert.deviceLabel)
        assertEquals("10.0.0.1", alert.deviceAddress)
        assertEquals("HQ", alert.branchLabel)
    }

    @Test
    fun `flat columns win over the embedded asset when present`() {
        val payload = """
            {"alerts":[{
              "id": 8,
              "device_name": "flat-name",
              "device_ip": "192.168.1.1",
              "branch_name": "Flat Branch",
              "network_asset": {"sys_name": "nested", "ip_address": "10.0.0.1", "branch_name": "Nested"}
            }]}
        """.trimIndent()

        val alert = json.decodeFromString<AlertsResponse>(payload).alerts.single()

        assertEquals("flat-name", alert.deviceLabel)
        assertEquals("192.168.1.1", alert.deviceAddress)
        assertEquals("Flat Branch", alert.branchLabel)
    }

    @Test
    fun `alert without a network_asset still parses`() {
        val payload = """{"alerts":[{"id": 9, "severity": "info", "message": "hello"}]}"""
        val alert = json.decodeFromString<AlertsResponse>(payload).alerts.single()

        assertNull(alert.networkAsset)
        assertNull(alert.deviceLabel)
        assertEquals("info", alert.severityKey)
    }

    @Test
    fun `unknown server fields are ignored rather than fatal`() {
        val payload = """
            {"alerts":[{"id": 10, "severity": "info", "something_new": {"a": 1}}],
             "totally_new_top_level": 5}
        """.trimIndent()

        val response = json.decodeFromString<AlertsResponse>(payload)
        assertEquals(1, response.alerts.size)
    }

    @Test
    fun `empty payload yields an empty list`() {
        assertTrue(json.decodeFromString<AlertsResponse>("{}").alerts.isEmpty())
    }
}
