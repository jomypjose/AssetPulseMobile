package com.assetpulse.monitor.data

import com.assetpulse.monitor.data.model.DeviceListResponse
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Regression tests for `/network`.
 *
 * The live server returns `snmp_uptime` preformatted ("53d 9h 12m 44s") and is
 * inconsistent about whether numeric columns are JSON numbers or quoted
 * strings. Typing those strictly made one row's odd column throw away the
 * entire device list, so these pin the tolerant behaviour.
 */
class DeviceParsingTest {

    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
        isLenient = true
    }

    @Test
    fun `parses the preformatted uptime string`() {
        val payload = """
            {"data":[{
              "id": 570,
              "hostname": "Sophos XGS87",
              "snmp_uptime": "53d 9h 12m 44s",
              "enable_monitoring": true,
              "monitoring_status": "Online"
            }]}
        """.trimIndent()

        val device = json.decodeFromString<DeviceListResponse>(payload).data.single()
        assertEquals("53d 9h 12m 44s", device.snmpUptime)
    }

    @Test
    fun `accepts numeric columns as JSON numbers`() {
        val payload = """
            {"data":[{"id":1,"cpu_usage":42.6,"memory_used":1000,"memory_total":4000,"latency":12.5}]}
        """.trimIndent()

        val device = json.decodeFromString<DeviceListResponse>(payload).data.single()
        assertEquals(43, device.cpuPercent)
        assertEquals(25, device.memoryPercent)
        assertEquals(12.5, device.latency!!, 0.001)
    }

    @Test
    fun `accepts the same columns as quoted strings`() {
        val payload = """
            {"data":[{"id":1,"cpu_usage":"42.6","memory_used":"1000","memory_total":"4000","latency":"12.5"}]}
        """.trimIndent()

        val device = json.decodeFromString<DeviceListResponse>(payload).data.single()
        assertEquals(43, device.cpuPercent)
        assertEquals(25, device.memoryPercent)
        assertEquals(12.5, device.latency!!, 0.001)
    }

    @Test
    fun `an unparseable numeric column yields null instead of failing the row`() {
        val payload = """{"data":[{"id":1,"cpu_usage":"n/a","memory_used":"unknown"}]}"""
        val device = json.decodeFromString<DeviceListResponse>(payload).data.single()

        assertNull(device.cpuPercent)
        assertNull(device.memoryPercent)
        assertEquals(1, device.id)
    }

    @Test
    fun `one odd row does not cost us the rest of the list`() {
        val payload = """
            {"data":[
              {"id":1,"cpu_usage":"n/a","snmp_uptime":"1d 2h"},
              {"id":2,"cpu_usage":50,"snmp_uptime":"3d 4h"},
              {"id":3,"cpu_usage":null}
            ]}
        """.trimIndent()

        val devices = json.decodeFromString<DeviceListResponse>(payload).data
        assertEquals(listOf(1, 2, 3), devices.map { it.id })
        assertEquals(50, devices[1].cpuPercent)
    }

    @Test
    fun `extra block numerics are equally tolerant`() {
        val payload = """
            {"data":[{"id":1,"extra":{"cpu_count":4,"memory_used":"3000","memory_total":"4000"}}]}
        """.trimIndent()

        val device = json.decodeFromString<DeviceListResponse>(payload).data.single()
        assertEquals(4, device.extra?.cpuCount)
        assertEquals(75, device.memoryPercent)
    }

    @Test
    fun `unknown columns are ignored`() {
        val payload = """{"data":[{"id":1,"capabilities":{"snmp":true},"brand_new":[1,2,3]}]}"""
        assertEquals(1, json.decodeFromString<DeviceListResponse>(payload).data.single().id)
    }
}
