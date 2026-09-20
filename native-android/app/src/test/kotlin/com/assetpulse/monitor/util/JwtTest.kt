package com.assetpulse.monitor.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64

class JwtTest {

    private val now = 1_700_000_000_000L

    private fun tokenExpiringAt(epochSeconds: Long): String {
        val payload = """{"sub":"42","exp":$epochSeconds,"role":"admin"}"""
        val encoded = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(payload.toByteArray())
        return "header.$encoded.signature"
    }

    @Test
    fun `reads the expiry out of the payload`() {
        val token = tokenExpiringAt(1_700_000_500L)
        assertEquals(1_700_000_500_000L, Jwt.expiresAtMillis(token))
    }

    @Test
    fun `token well inside its lifetime is not expiring`() {
        assertFalse(Jwt.isExpiringSoon(tokenExpiringAt(now / 1000 + 3600), nowMillis = now))
    }

    @Test
    fun `token just outside the skew is not expiring`() {
        assertFalse(Jwt.isExpiringSoon(tokenExpiringAt(now / 1000 + 61), nowMillis = now))
    }

    @Test
    fun `token inside the 60s skew counts as expiring`() {
        assertTrue(Jwt.isExpiringSoon(tokenExpiringAt(now / 1000 + 30), nowMillis = now))
    }

    @Test
    fun `already expired token counts as expiring`() {
        assertTrue(Jwt.isExpiringSoon(tokenExpiringAt(now / 1000 - 10), nowMillis = now))
    }

    @Test
    fun `unreadable token does not trigger a refresh on every request`() {
        assertFalse(Jwt.isExpiringSoon("not-a-jwt", nowMillis = now))
        assertFalse(Jwt.isExpiringSoon(null, nowMillis = now))
        assertFalse(Jwt.isExpiringSoon("", nowMillis = now))
        assertNull(Jwt.expiresAtMillis("only.two"))
    }

    @Test
    fun `payload without exp yields no expiry`() {
        val payload = Base64.getUrlEncoder().withoutPadding()
            .encodeToString("""{"sub":"42"}""".toByteArray())
        assertNull(Jwt.expiresAtMillis("header.$payload.sig"))
    }
}
