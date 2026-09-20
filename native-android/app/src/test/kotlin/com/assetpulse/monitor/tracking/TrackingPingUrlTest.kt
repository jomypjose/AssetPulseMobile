package com.assetpulse.monitor.tracking

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The app stores its server address with the `/api` prefix already attached
 * (ServerSetupScreen appends it), but the reference agent in
 * `agent/mobile/android-service-guide.md` assumes a bare origin and appends
 * `/api/tracking/agent/ping` itself. Joining those naively produces
 * `/api/api/tracking/agent/ping` and every ping 404s, so the collapse is
 * pinned here.
 */
class TrackingPingUrlTest {

    private val expected = "https://assetpulse.escco.in/api/tracking/agent/ping"

    @Test
    fun `collapses the api prefix the app already stores`() {
        assertEquals(expected, TrackingPreferences.pingUrl("https://assetpulse.escco.in/api"))
    }

    @Test
    fun `handles a trailing slash after the api prefix`() {
        assertEquals(expected, TrackingPreferences.pingUrl("https://assetpulse.escco.in/api/"))
    }

    @Test
    fun `appends the full path to a bare origin`() {
        assertEquals(expected, TrackingPreferences.pingUrl("https://assetpulse.escco.in"))
    }

    @Test
    fun `handles a bare origin with a trailing slash`() {
        assertEquals(expected, TrackingPreferences.pingUrl("https://assetpulse.escco.in/"))
    }

    @Test
    fun `preserves a port`() {
        assertEquals(
            "https://10.0.0.5:3001/api/tracking/agent/ping",
            TrackingPreferences.pingUrl("https://10.0.0.5:3001/api"),
        )
    }

    @Test
    fun `does not mistake a host containing api for the prefix`() {
        // "rapids" ends in neither "/api" nor a path segment we should strip.
        assertEquals(
            "https://rapids.example.com/api/tracking/agent/ping",
            TrackingPreferences.pingUrl("https://rapids.example.com"),
        )
    }

    @Test
    fun `leaves an unrelated path prefix intact`() {
        assertEquals(
            "https://host.local/assetpulse/api/tracking/agent/ping",
            TrackingPreferences.pingUrl("https://host.local/assetpulse"),
        )
    }

    @Test
    fun `trims surrounding whitespace`() {
        assertEquals(expected, TrackingPreferences.pingUrl("  https://assetpulse.escco.in/api  "))
    }
}
