package com.assetpulse.monitor.ui.screens.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.assetpulse.monitor.data.repository.MonitoringRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class BadgeState(
    val unacknowledgedAlerts: Int = 0,
    val unreadMessages: Int = 0,
)

/**
 * Drives the tab-bar counts.
 *
 * The RN app polled alerts, conversations and the unread count together here.
 * Messaging lands in Phase 4, so for now only the alert badge is live and
 * `unreadMessages` stays at zero rather than showing a number we can't source.
 */
@HiltViewModel
class BadgeViewModel @Inject constructor(
    private val repository: MonitoringRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(BadgeState())
    val state: StateFlow<BadgeState> = _state.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            // Badges are decoration; a failure here must stay silent.
            runCatching {
                val alerts = repository.getAlerts().value
                _state.value = _state.value.copy(
                    unacknowledgedAlerts = alerts.count { !it.isAcknowledged },
                )
            }
        }
    }
}
