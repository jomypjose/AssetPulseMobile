package com.assetpulse.monitor.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Parity tests against `normaliseUrl` in ServerSetupScreen.js. The https
 * upgrade is a security property, not a convenience, so it gets pinned here.
 */
class ServerUrlTest {

    @Test
    fun `bare host gets https and api suffix`() {
        assertEquals("https://assetpulse.example.com/api", ServerUrl.normalise(allowCleartext = false, raw = "assetpulse.example.com"))
    }

    @Test
    fun `plaintext http is upgraded to https`() {
        assertEquals("https://host.local/api", ServerUrl.normalise(allowCleartext = false, raw = "http://host.local"))
    }

    @Test
    fun `uppercase http scheme is also upgraded`() {
        assertEquals("https://host.local/api", ServerUrl.normalise(allowCleartext = false, raw = "HTTP://host.local"))
    }

    @Test
    fun `existing https is preserved`() {
        assertEquals("https://host.local/api", ServerUrl.normalise(allowCleartext = false, raw = "https://host.local"))
    }

    @Test
    fun `trailing slashes are stripped before suffixing`() {
        assertEquals("https://host.local/api", ServerUrl.normalise(allowCleartext = false, raw = "https://host.local///"))
    }

    @Test
    fun `existing api suffix is not duplicated`() {
        assertEquals("https://host.local/api", ServerUrl.normalise(allowCleartext = false, raw = "https://host.local/api"))
    }

    @Test
    fun `api suffix with trailing slash is not duplicated`() {
        // Trailing slash is stripped first, so this lands on the plain suffix.
        assertEquals("https://host.local/api", ServerUrl.normalise(allowCleartext = false, raw = "https://host.local/api/"))
    }

    @Test
    fun `port is preserved`() {
        assertEquals("https://host.local:8443/api", ServerUrl.normalise(allowCleartext = false, raw = "host.local:8443"))
    }

    @Test
    fun `blank input is rejected`() {
        assertNull(ServerUrl.normalise(allowCleartext = false, raw = "   "))
    }

    // ── Debug builds keep cleartext so local dev servers are reachable ──

    @Test
    fun `debug builds keep a typed http address`() {
        assertEquals(
            "http://185.175.165.4:3001/api",
            ServerUrl.normalise("http://185.175.165.4:3001", allowCleartext = true),
        )
    }

    @Test
    fun `debug builds still default a bare host to https`() {
        assertEquals(
            "https://host.local/api",
            ServerUrl.normalise("host.local", allowCleartext = true),
        )
    }

    @Test
    fun `no upgrade notice when cleartext is allowed`() {
        assertFalse(ServerUrl.wasPlaintext("http://host.local", allowCleartext = true))
    }

    @Test
    fun `plaintext input is reported so the user can be told`() {
        assertTrue(ServerUrl.wasPlaintext(" http://host.local ", allowCleartext = false))
        assertFalse(ServerUrl.wasPlaintext("https://host.local", allowCleartext = false))
        assertFalse(ServerUrl.wasPlaintext("host.local", allowCleartext = false))
    }
}
