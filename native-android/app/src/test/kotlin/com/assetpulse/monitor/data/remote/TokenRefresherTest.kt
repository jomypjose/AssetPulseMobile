package com.assetpulse.monitor.data.remote

import com.assetpulse.monitor.data.local.TokenStore
import com.assetpulse.monitor.data.model.RefreshRequest
import com.assetpulse.monitor.data.model.RefreshResponse
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.IOException
import java.util.concurrent.atomic.AtomicInteger

/**
 * The backend rotates refresh tokens and revokes the whole token family if a
 * superseded one is replayed, so two concurrent 401s must result in exactly
 * one `/auth/refresh`. These tests pin that.
 */
class TokenRefresherTest {

    private class FakeTokenStore(
        override var accessToken: String? = null,
        override var refreshToken: String? = null,
    ) : TokenStore {
        override fun clear() {
            accessToken = null
            refreshToken = null
        }
    }

    private class FakeRefreshApi(
        private val delayMs: Long = 0,
        private val behaviour: (Int) -> RefreshResponse,
    ) : RefreshApi {
        val calls = AtomicInteger(0)
        val seenRefreshTokens = mutableListOf<String>()

        override suspend fun refresh(body: RefreshRequest): RefreshResponse {
            val n = calls.incrementAndGet()
            synchronized(seenRefreshTokens) { seenRefreshTokens.add(body.refreshToken) }
            if (delayMs > 0) delay(delayMs)
            return behaviour(n)
        }
    }

    @Test
    fun `concurrent callers with the same stale token trigger exactly one refresh`() = runTest {
        val store = FakeTokenStore(accessToken = "stale", refreshToken = "r1")
        val api = FakeRefreshApi(delayMs = 50) { RefreshResponse(token = "fresh", refreshToken = "r2") }
        val refresher = TokenRefresher(store, { api })

        val results = (1..8).map { async { refresher.refresh(staleToken = "stale") } }.awaitAll()

        assertEquals("refresh must be single-flight", 1, api.calls.get())
        assertEquals(List(8) { "fresh" }, results)
        assertEquals("fresh", store.accessToken)
    }

    @Test
    fun `the rotated refresh token is stored and never replayed`() = runTest {
        val store = FakeTokenStore(accessToken = "stale", refreshToken = "r1")
        val api = FakeRefreshApi(delayMs = 20) { RefreshResponse(token = "fresh", refreshToken = "r2") }
        val refresher = TokenRefresher(store, { api })

        (1..5).map { async { refresher.refresh(staleToken = "stale") } }.awaitAll()

        assertEquals(listOf("r1"), api.seenRefreshTokens)
        assertEquals("r2", store.refreshToken)
    }

    @Test
    fun `a caller whose token was already rotated reuses it instead of refreshing`() = runTest {
        val store = FakeTokenStore(accessToken = "already-fresh", refreshToken = "r1")
        val api = FakeRefreshApi { RefreshResponse(token = "should-not-happen") }
        val refresher = TokenRefresher(store, { api })

        val result = refresher.refresh(staleToken = "stale")

        assertEquals("already-fresh", result)
        assertEquals(0, api.calls.get())
    }

    @Test
    fun `no refresh token means no refresh`() = runTest {
        val store = FakeTokenStore(accessToken = "stale", refreshToken = null)
        val api = FakeRefreshApi { RefreshResponse(token = "fresh") }
        val refresher = TokenRefresher(store, { api })

        assertNull(refresher.refresh(staleToken = "stale"))
        assertEquals(0, api.calls.get())
    }

    @Test
    fun `a failing refresh leaves the stored session intact`() = runTest {
        // Sign-out is manual in this app; a dead refresh must not clear tokens.
        val store = FakeTokenStore(accessToken = "stale", refreshToken = "r1")
        val api = object : RefreshApi {
            override suspend fun refresh(body: RefreshRequest): RefreshResponse =
                throw IOException("network down")
        }
        val refresher = TokenRefresher(store, { api })

        assertNull(refresher.refresh(staleToken = "stale"))
        assertEquals("stale", store.accessToken)
        assertEquals("r1", store.refreshToken)
    }

    @Test
    fun `a response without a token is treated as failure`() = runTest {
        val store = FakeTokenStore(accessToken = "stale", refreshToken = "r1")
        val api = FakeRefreshApi { RefreshResponse(token = null, refreshToken = "r2") }
        val refresher = TokenRefresher(store, { api })

        assertNull(refresher.refresh(staleToken = "stale"))
        assertEquals("stale", store.accessToken)
        assertEquals("r1", store.refreshToken)
    }
}
