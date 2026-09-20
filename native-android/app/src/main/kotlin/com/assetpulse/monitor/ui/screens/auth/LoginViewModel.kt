package com.assetpulse.monitor.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.assetpulse.monitor.data.model.User
import com.assetpulse.monitor.data.remote.toApiException
import com.assetpulse.monitor.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginState(
    val username: String = "",
    val password: String = "",
    val passwordVisible: Boolean = false,
    val isSubmitting: Boolean = false,
    val error: String? = null,
) {
    val canSubmit: Boolean
        get() = username.isNotBlank() && password.isNotBlank() && !isSubmitting
}

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(LoginState())
    val state: StateFlow<LoginState> = _state.asStateFlow()

    fun onUsernameChange(value: String) {
        _state.value = _state.value.copy(username = value, error = null)
    }

    fun onPasswordChange(value: String) {
        _state.value = _state.value.copy(password = value, error = null)
    }

    fun togglePasswordVisible() {
        _state.value = _state.value.copy(passwordVisible = !_state.value.passwordVisible)
    }

    fun submit(onSuccess: (User) -> Unit) {
        val current = _state.value
        if (!current.canSubmit) return

        _state.value = current.copy(isSubmitting = true, error = null)
        viewModelScope.launch {
            try {
                val user = authRepository.login(current.username.trim(), current.password)
                _state.value = _state.value.copy(isSubmitting = false, password = "")
                onSuccess(user)
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isSubmitting = false,
                    error = e.toApiException().message,
                )
            }
        }
    }

    /** "Use a different server" — clears the saved address and signs out. */
    fun changeServer(onCleared: () -> Unit) {
        viewModelScope.launch {
            authRepository.clearServer()
            onCleared()
        }
    }
}
