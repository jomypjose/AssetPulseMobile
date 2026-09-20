package com.assetpulse.monitor.ui

import com.assetpulse.monitor.data.model.Device
import com.assetpulse.monitor.data.model.DeviceStatus
import com.assetpulse.monitor.ui.screens.devices.DevicesState
import org.junit.Assert.assertEquals
import org.junit.Test

class DevicesStateTest {

    private fun device(
        id: Int,
        hostname: String? = null,
        sysName: String? = null,
        ip: String? = null,
        location: String? = null,
        status: String? = "Online",
    ) = Device(
        id = id,
        hostname = hostname,
        sysName = sysName,
        ipAddress = ip,
        sysLocation = location,
        monitoringStatus = status,
    )

    private val devices = listOf(
        device(1, hostname = "edge-router", ip = "10.0.0.1", status = "Offline"),
        device(2, hostname = "core-switch", ip = "10.0.0.2", status = "Online"),
        device(3, sysName = "branch-ap", ip = "10.0.1.7", location = "Kochi", status = "Warning"),
        device(4, hostname = "nas", ip = "10.0.0.9", status = "Online"),
    )

    @Test
    fun `groups online first then warning then offline`() {
        val visible = DevicesState(devices = devices).visibleDevices
        assertEquals(
            listOf(DeviceStatus.ONLINE, DeviceStatus.ONLINE, DeviceStatus.WARNING, DeviceStatus.OFFLINE),
            visible.map { it.status },
        )
    }

    @Test
    fun `sorts alphabetically within a status group`() {
        val online = DevicesState(devices = devices).visibleDevices
            .filter { it.status == DeviceStatus.ONLINE }
        assertEquals(listOf("core-switch", "nas"), online.map { it.displayName })
    }

    @Test
    fun `search matches hostname, system name, address and location`() {
        fun search(q: String) = DevicesState(devices = devices, query = q).visibleDevices.map { it.id }

        assertEquals(listOf(1), search("edge"))
        assertEquals(listOf(3), search("branch-ap"))
        assertEquals(listOf(4), search("10.0.0.9"))
        assertEquals(listOf(3), search("kochi"))
    }

    @Test
    fun `search is case insensitive and trims padding`() {
        assertEquals(
            listOf(1),
            DevicesState(devices = devices, query = "  EDGE-Router ").visibleDevices.map { it.id },
        )
    }

    @Test
    fun `status filter narrows the list`() {
        val offline = DevicesState(devices = devices, filter = DeviceStatus.OFFLINE).visibleDevices
        assertEquals(listOf(1), offline.map { it.id })
    }

    @Test
    fun `search and filter compose`() {
        val state = DevicesState(devices = devices, query = "10.0.0", filter = DeviceStatus.ONLINE)
        assertEquals(listOf(2, 4), state.visibleDevices.map { it.id })
    }

    @Test
    fun `counts are per status across the unfiltered list`() {
        val state = DevicesState(devices = devices, filter = DeviceStatus.OFFLINE)
        assertEquals(2, state.countFor(DeviceStatus.ONLINE))
        assertEquals(1, state.countFor(DeviceStatus.WARNING))
        assertEquals(1, state.countFor(DeviceStatus.OFFLINE))
    }

    @Test
    fun `display name falls back through hostname, system name then address`() {
        assertEquals("edge-router", device(1, hostname = "edge-router", ip = "10.0.0.1").displayName)
        assertEquals("branch-ap", device(2, sysName = "branch-ap", ip = "10.0.0.2").displayName)
        assertEquals("10.0.0.3", device(3, ip = "10.0.0.3").displayName)
        assertEquals("Device 4", device(4).displayName)
    }
}
