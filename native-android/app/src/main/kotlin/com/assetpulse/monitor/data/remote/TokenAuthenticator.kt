package com.assetpulse.monitor.data.remote

import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Handles the 401 path: refresh once, retry the original request once.
 *
 * Deliberately does NOT clear tokens or force a sign-out when refresh fails.
 * That mirrors the RN client, where a genuinely dead session simply surfaces
 * the request error and leaves the user signed in (sign-out is manual, from
 * Settings). Users of this app sit behind flaky on-prem networks, and being
 * kicked to the login screen on a transient backend blip was not wanted.
 */
@Singleton
class TokenAuthenticator @Inject constructor(
    private val refresher: TokenRefresher,
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        // Only ever retry once — OkHttp would otherwise loop.
        if (response.priorResponseCount >= 1) return null

        val stale = response.request.header("Authorization")
            ?.removePrefix("Bearer ")
            ?.trim()

        val fresh = runBlocking { refresher.refresh(staleToken = stale) } ?: return null
        if (fresh == stale) return null

        return response.request.newBuilder()
            .header("Authorization", "Bearer $fresh")
            .build()
    }

    private val Response.priorResponseCount: Int
        get() {
            var count = 0
            var prior = priorResponse
            while (prior != null) {
                count++
                prior = prior.priorResponse
            }
            return count
        }
}
