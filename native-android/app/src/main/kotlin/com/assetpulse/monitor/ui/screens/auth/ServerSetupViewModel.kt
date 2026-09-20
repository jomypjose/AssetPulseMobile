package com.assetpulse.monitor.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.assetpulse.monitor.data.remote.HealthProbe
import com.assetpulse.monitor.data.remote.ProbeResult
import com.assetpulse.monitor.data.repository.AuthRepository
import com.assetpulse.monitor.util.ServerUrl
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class ProbeStatus { IDLE, VERIFYING, OK, ERROR }

data class ServerSetupState(
    val input: String = "",
    val status: ProbeStatus = ProbeStatus.IDLE,
    val message: String = "",
    val resolvedUrl: String = "",
    val shakeTick: Int = 0,
) {
    val canVerify: Boolean get() = input.trim().length > 3 && status != ProbeStatus.VERIFYING
}

@HiltViewModel
class ServerSetupViewModel @Inject constructor(
    private val healthProbe: HealthProbe,
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ServerSetupState())
    val state: StateFlow<ServerSetupState> = _state.asStateFlow()

    fun onInputChange(value: String) {
        _state.value = _state.value.copy(
            input = value,
            status = ProbeStatus.IDLE,
            message = "",
        )
    }

    fun verify() {
        val raw = _state.value.input
        val url = ServerUrl.normalise(raw)
        if (url == null) {
            fail("Enter a valid server address.")
            return
        }

        _state.value = _state.value.copy(
            status = ProbeStatus.VERIFYING,
            resolvedUrl = url,
            // Tell the user we rewrote their http:// address rather than
            // silently connecting somewhere they didn't type.
            message = if (ServerUrl.wasPlaintext(raw)) {
                "Upgraded to HTTPS — plain HTTP isn't supported."
            } else "",
        )

        viewModelScope.launch {
            when (val result = healthProbe.check(url)) {
                is ProbeResult.Ok -> _state.value = _state.value.copy(
                    status = ProbeStatus.OK,
                    message = result.message,
                )
                is ProbeResult.Failed -> fail(result.message)
            }
        }
    }

    /** Persists the verified address; the nav graph reacts to the session state. */
    fun connect(onSaved: (String) -> Unit) {
        val current = _state.value
        if (current.status != ProbeStatus.OK) return
        viewModelScope.launch {
            authRepository.saveServerUrl(current.resolvedUrl)
            onSaved(current.resolvedUrl)
        }
    }

    private fun fail(message: String) {
        _state.value = _state.value.copy(
            status = ProbeStatus.ERROR,
            message = message,
            shakeTick = _state.value.shakeTick + 1,
        )
    }
}
