package com.assetpulse.monitor.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.assetpulse.monitor.data.local.AppPreferences
import com.assetpulse.monitor.data.model.User
import com.assetpulse.monitor.data.repository.AuthRepository
import com.assetpulse.monitor.ui.theme.ThemeMode
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SessionState(
    val isLoading: Boolean = true,
    val serverUrl: String? = null,
    val user: User? = null,
    val hasToken: Boolean = false,
    val biometricLocked: Boolean = false,
) {
    val isServerConfigured: Boolean get() = !serverUrl.isNullOrBlank()
    val isAuthenticated: Boolean get() = hasToken && !biometricLocked
}

/**
 * Owns the app-wide session. Mirrors the boot sequence in AuthContext.js:
 * server URL -> token -> cached user -> biometric gate.
 *
 * As in the RN app, a stored token is trusted optimistically at boot with no
 * network validation — the first real API call is what discovers a dead
 * session, and even then the user is not signed out automatically.
 */
@HiltViewModel
class SessionViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    preferences: AppPreferences,
) : ViewModel() {

    private val _state = MutableStateFlow(SessionState())
    val state: StateFlow<SessionState> = _state.asStateFlow()

    val themeMode: StateFlow<ThemeMode> = preferences.themeMode
        .stateIn(viewModelScope, SharingStarted.Eagerly, ThemeMode.SYSTEM)

    init {
        bootstrap()
    }

    private fun bootstrap() {
        viewModelScope.launch {
            val serverUrl = authRepository.restoreServerUrl()
            val token = authRepository.storedToken()
            val user = authRepository.storedUser()

            val signedIn = token != null && user != null
            val locked = signedIn && authRepository.isBiometricEnabled()

            _state.value = SessionState(
                isLoading = false,
                serverUrl = serverUrl,
                user = user,
                hasToken = signedIn,
                biometricLocked = locked,
            )

            // Non-blocking, best-effort: pick up a changed profile picture etc.
            if (signedIn && !locked) refreshProfileQuietly()
        }
    }

    fun onServerSaved(url: String) {
        _state.value = _state.value.copy(serverUrl = url)
    }

    fun onLoggedIn(user: User) {
        viewModelScope.launch {
            val locked = authRepository.isBiometricEnabled()
            _state.value = _state.value.copy(
                user = user,
                hasToken = true,
                biometricLocked = false, // just authenticated with a password
            )
            if (!locked) refreshProfileQuietly()
        }
    }

    fun onBiometricUnlocked() {
        _state.value = _state.value.copy(biometricLocked = false)
        refreshProfileQuietly()
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _state.value = _state.value.copy(
                user = null,
                hasToken = false,
                biometricLocked = false,
            )
        }
    }

    /** Sign out and forget the server, returning the app to first-run setup. */
    fun clearServer() {
        viewModelScope.launch {
            authRepository.clearServer()
            _state.value = SessionState(isLoading = false)
        }
    }

    private fun refreshProfileQuietly() {
        viewModelScope.launch {
            authRepository.refreshProfile()?.let { user ->
                _state.value = _state.value.copy(user = user)
            }
        }
    }
}
