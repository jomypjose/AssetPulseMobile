package com.assetpulse.monitor.data.repository

import com.assetpulse.monitor.data.local.AppPreferences
import com.assetpulse.monitor.data.local.TokenStore
import com.assetpulse.monitor.data.model.LoginRequest
import com.assetpulse.monitor.data.model.LogoutRequest
import com.assetpulse.monitor.data.model.User
import com.assetpulse.monitor.data.remote.ApiException
import com.assetpulse.monitor.data.remote.AssetPulseApi
import com.assetpulse.monitor.data.remote.ServerUrlProvider
import com.assetpulse.monitor.data.remote.toApiException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Server configuration, sign-in/sign-out and the persisted session — the
 * native counterpart of `src/context/AuthContext.js`.
 */
@Singleton
class AuthRepository @Inject constructor(
    private val api: AssetPulseApi,
    private val tokenStore: TokenStore,
    private val prefs: AppPreferences,
    private val serverUrlProvider: ServerUrlProvider,
) {

    /** Applies the stored server address so the API client can reach it. */
    suspend fun restoreServerUrl(): String? = withContext(Dispatchers.IO) {
        val stored = prefs.currentServerUrl()
        serverUrlProvider.set(stored)
        stored
    }

    suspend fun storedUser(): User? = withContext(Dispatchers.IO) { prefs.currentUser() }

    fun storedToken(): String? = tokenStore.accessToken

    suspend fun isBiometricEnabled(): Boolean = prefs.isBiometricEnabled()

    /** Persists a verified server address and points the API client at it. */
    suspend fun saveServerUrl(url: String) = withContext(Dispatchers.IO) {
        val normalised = url.trim().trimEnd('/')
        prefs.setServerUrl(normalised)
        serverUrlProvider.set(normalised)
    }

    suspend fun login(username: String, password: String): User = withContext(Dispatchers.IO) {
        val response = runCatching { api.login(LoginRequest(username, password)) }
            .getOrElse { throw it.toApiException() }

        val token = response.token
        if (token.isNullOrBlank()) {
            // The server only omits the token when it fell back to cookie
            // transport, which means our X-Token-Transport header didn't take.
            throw ApiException(
                "Server did not return a sign-in token. It may be configured for " +
                    "browser cookie authentication only."
            )
        }

        tokenStore.accessToken = token
        response.refreshToken?.takeIf { it.isNotBlank() }?.let { tokenStore.refreshToken = it }

        val user = response.user ?: User(username = username)
        prefs.setUser(user)
        user
    }

    /**
     * Best-effort profile refresh. The RN app did this shortly after boot and
     * after login, mainly to pick up a changed profile picture; failures are
     * ignored because the cached user is good enough to render with.
     */
    suspend fun refreshProfile(): User? = withContext(Dispatchers.IO) {
        val user = runCatching { api.getProfile().user }.getOrNull() ?: return@withContext null
        prefs.setUser(user)
        user
    }

    /**
     * Signs out. The server call goes first and on purpose: it needs the
     * still-valid tokens to revoke the refresh-token family, which clearing
     * local storage first would destroy. Its failure must not block sign-out.
     */
    suspend fun logout() = withContext(Dispatchers.IO) {
        runCatching { api.logout(LogoutRequest(tokenStore.refreshToken)) }
        tokenStore.clear()
        prefs.setUser(null)
    }

    /** Sign out *and* forget the server address, returning to first-run setup. */
    suspend fun clearServer() = withContext(Dispatchers.IO) {
        logout()
        prefs.setServerUrl(null)
        serverUrlProvider.set(null)
    }
}
