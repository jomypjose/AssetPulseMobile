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
        assertEquals("https://assetpulse.example.com/api", ServerUrl.normalise("assetpulse.example.com"))
    }

    @Test
    fun `plaintext http is upgraded to https`() {
        assertEquals("https://host.local/api", ServerUrl.normalise("http://host.local"))
    }

    @Test
    fun `uppercase http scheme is also upgraded`() {
        assertEquals("https://host.local/api", ServerUrl.normalise("HTTP://host.local"))
    }

    @Test
    fun `existing https is preserved`() {
        assertEquals("https://host.local/api", ServerUrl.normalise("https://host.local"))
    }

    @Test
    fun `trailing slashes are stripped before suffixing`() {
        assertEquals("https://host.local/api", ServerUrl.normalise("https://host.local///"))
    }

    @Test
    fun `existing api suffix is not duplicated`() {
        assertEquals("https://host.local/api", ServerUrl.normalise("https://host.local/api"))
    }

    @Test
    fun `api suffix with trailing slash is not duplicated`() {
        // Trailing slash is stripped first, so this lands on the plain suffix.
        assertEquals("https://host.local/api", ServerUrl.normalise("https://host.local/api/"))
    }

    @Test
    fun `port is preserved`() {
        assertEquals("https://host.local:8443/api", ServerUrl.normalise("host.local:8443"))
    }

    @Test
    fun `blank input is rejected`() {
        assertNull(ServerUrl.normalise("   "))
    }

    @Test
    fun `plaintext input is reported so the user can be told`() {
        assertTrue(ServerUrl.wasPlaintext(" http://host.local "))
        assertFalse(ServerUrl.wasPlaintext("https://host.local"))
        assertFalse(ServerUrl.wasPlaintext("host.local"))
    }
}
