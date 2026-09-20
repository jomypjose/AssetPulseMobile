package com.assetpulse.monitor.data.remote

import com.assetpulse.monitor.data.local.TokenStore
import com.assetpulse.monitor.util.Jwt
import kotlinx.coroutines.runBlocking
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Response
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/** Marks a call that must not carry (or refresh) an Authorization header. */
const val HEADER_NO_AUTH = "X-AssetPulse-No-Auth"

/**
 * Retrofit needs a base URL at build time, but ours is only known at runtime.
 * Requests are therefore built against a placeholder host and rewritten here
 * onto the configured server, preserving any path prefix the user's URL
 * carries (e.g. `https://host/api` + `/auth/login` -> `/api/auth/login`).
 */
@Singleton
class HostSelectionInterceptor @Inject constructor(
    private val serverUrlProvider: ServerUrlProvider,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val configured = serverUrlProvider.baseUrl
            ?: throw IOException("Server address is not configured yet.")
        val base = configured.toHttpUrlOrNull()
            ?: throw IOException("Server address is not a valid URL: $configured")

        val prefix = base.encodedPath.trimEnd('/')
        val rewritten = request.url.newBuilder()
            .scheme(base.scheme)
            .host(base.host)
            .port(base.port)
            .encodedPath(prefix + request.url.encodedPath)
            .build()

        return chain.proceed(request.newBuilder().url(rewritten).build())
    }
}

/**
 * Attaches `X-Token-Transport: body` to every request and a bearer token to
 * authenticated ones, refreshing proactively when the access token is within
 * the expiry skew.
 *
 * `X-Token-Transport: body` is load-bearing: the backend defaults to
 * httpOnly-cookie auth for browsers, and without this header `/auth/login`
 * and `/auth/refresh` return no token in the JSON payload at all.
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenStore: TokenStore,
    private val refresher: TokenRefresher,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val builder = original.newBuilder()
            .header("X-Token-Transport", "body")

        val skipAuth = original.header(HEADER_NO_AUTH) != null
        builder.removeHeader(HEADER_NO_AUTH)

        if (!skipAuth) {
            var token = tokenStore.accessToken
            if (Jwt.isExpiringSoon(token) && tokenStore.refreshToken != null) {
                // Proactive refresh. If it fails we deliberately fall through
                // with the stale token and let the 401 path deal with it —
                // same as the RN client, which swallowed this error.
                token = runBlocking { refresher.refresh(staleToken = token) } ?: token
            }
            token?.let { builder.header("Authorization", "Bearer $it") }
        }

        return chain.proceed(builder.build())
    }
}
