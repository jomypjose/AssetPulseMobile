package com.assetpulse.monitor.data.remote

import com.assetpulse.monitor.data.local.TokenStore
import com.assetpulse.monitor.data.model.RefreshRequest
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Provider
import javax.inject.Singleton

/**
 * Single-flight access-token refresh.
 *
 * This is the most safety-critical piece of the client. The backend *rotates*
 * refresh tokens and treats reuse of a superseded one as a breach, revoking
 * the entire token family — so two concurrent requests must never each fire
 * their own `/auth/refresh`.
 *
 * The RN client achieved this by sharing one in-flight Promise
 * (`refreshPromise` in src/services/api.js). Here a [Mutex] serialises
 * refreshes, and callers that were queued behind the lock check whether the
 * stored token has already moved on from the one that failed for them — if it
 * has, they reuse that result instead of refreshing again.
 *
 * Refresh is performed through [RefreshApi], which is backed by a bare OkHttp
 * client carrying neither [AuthInterceptor] nor [TokenAuthenticator], so a
 * failing refresh can never recurse into another refresh.
 */
@Singleton
class TokenRefresher @Inject constructor(
    private val tokenStore: TokenStore,
    private val refreshApi: Provider<RefreshApi>,
) {
    private val mutex = Mutex()

    /**
     * @param staleToken the access token the caller tried and found unusable.
     * @return a usable access token, or null if refresh is impossible.
     */
    suspend fun refresh(staleToken: String?): String? = mutex.withLock {
        // Someone else refreshed while we waited for the lock.
        val current = tokenStore.accessToken
        if (current != null && current != staleToken) return@withLock current

        val refreshToken = tokenStore.refreshToken ?: return@withLock null

        val response = runCatching {
            refreshApi.get().refresh(RefreshRequest(refreshToken))
        }.getOrElse { return@withLock null }

        val newAccess = response.token
        if (newAccess.isNullOrBlank()) return@withLock null

        tokenStore.accessToken = newAccess
        // The server rotates refresh tokens; store the new one when issued.
        response.refreshToken?.takeIf { it.isNotBlank() }?.let {
            tokenStore.refreshToken = it
        }
        newAccess
    }
}
