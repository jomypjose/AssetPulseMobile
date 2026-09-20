package com.assetpulse.monitor.ui

import com.assetpulse.monitor.data.local.OfflineCache
import com.assetpulse.monitor.data.model.Alert
import com.assetpulse.monitor.data.model.Device
import com.assetpulse.monitor.ui.screens.alerts.AlertsState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AlertsStateTest {

    private fun alert(id: Int, severity: String, status: String = "open") =
        Alert(id = id, severity = severity, status = status)

    private val alerts = listOf(
        alert(1, "critical"),
        alert(2, "warning", status = "acknowledged"),
        alert(3, "info"),
        alert(4, "critical", status = "resolved"),
    )

    /**
     * The API sends no `is_acknowledged` field; it is derived from `status`,
     * and the badge counts depend on getting that right.
     */
    @Test
    fun `acknowledged is derived from status`() {
        assertFalse(alert(1, "critical", status = "open").isAcknowledged)
        assertTrue(alert(2, "warning", status = "acknowledged").isAcknowledged)
        assertTrue(alert(3, "info", status = "resolved").isAcknowledged)
        assertFalse(alert(4, "info", status = "in_progress").isAcknowledged)
    }

    @Test
    fun `unacknowledged count ignores acknowledged and resolved`() {
        assertEquals(2, AlertsState(alerts = alerts).unacknowledgedCount)
    }

    @Test
    fun `severity filter narrows the list`() {
        val state = AlertsState(alerts = alerts, activeSeverity = "critical")
        assertEquals(listOf(1, 4), state.visibleAlerts.map { it.id })
    }

    @Test
    fun `no filter shows everything`() {
        assertEquals(4, AlertsState(alerts = alerts).visibleAlerts.size)
    }

    @Test
    fun `counts are grouped by severity`() {
        val counts = AlertsState(alerts = alerts).counts
        assertEquals(2, counts["critical"])
        assertEquals(1, counts["warning"])
        assertEquals(1, counts["info"])
    }

    @Test
    fun `missing severity falls back to unknown rather than crashing`() {
        val state = AlertsState(alerts = listOf(Alert(id = 9, severity = null)))
        assertEquals(1, state.counts["unknown"])
    }

    @Test
    fun `selection drives the bulk action bar`() {
        assertFalse(AlertsState(alerts = alerts).isSelecting)
        assertTrue(AlertsState(alerts = alerts, selectedIds = setOf(1)).isSelecting)
    }
}

class OfflineCacheFormatTest {

    private val now = 1_700_000_000_000L

    @Test
    fun `formats staleness the way the RN app worded it`() {
        assertEquals("just now", OfflineCache.formatStale(now - 30_000, now))
        assertEquals("5m ago", OfflineCache.formatStale(now - 5 * 60_000, now))
        assertEquals("59m ago", OfflineCache.formatStale(now - 59 * 60_000, now))
        assertEquals("2h ago", OfflineCache.formatStale(now - 2 * 3_600_000, now))
        assertEquals("23h ago", OfflineCache.formatStale(now - 23 * 3_600_000, now))
        assertEquals("3d ago", OfflineCache.formatStale(now - 3 * 86_400_000, now))
    }
}

class DeviceMetricsTest {

    @Test
    fun `memory percent prefers the richer detail block`() {
        val device = Device(
            id = 1,
            memoryUsed = 1_000,
            memoryTotal = 4_000,
            extra = com.assetpulse.monitor.data.model.DeviceExtra(
                memoryUsed = 3_000,
                memoryTotal = 4_000,
            ),
        )
        // /detail's `extra` block wins over the list-level fields.
        assertEquals(75, device.memoryPercent)
    }

    @Test
    fun `memory percent falls back to list level fields`() {
        val device = Device(id = 1, memoryUsed = 1_000, memoryTotal = 4_000)
        assertEquals(25, device.memoryPercent)
    }

    @Test
    fun `memory percent is null when the total is missing or zero`() {
        assertNull(Device(id = 1, memoryUsed = 500).memoryPercent)
        assertNull(Device(id = 1, memoryUsed = 500, memoryTotal = 0).memoryPercent)
    }

    @Test
    fun `cpu percent rounds`() {
        assertEquals(43, Device(id = 1, cpuUsage = 42.6).cpuPercent)
        assertNull(Device(id = 1).cpuPercent)
    }
}
