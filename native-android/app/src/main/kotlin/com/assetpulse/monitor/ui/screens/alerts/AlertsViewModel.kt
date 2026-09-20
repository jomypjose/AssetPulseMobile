package com.assetpulse.monitor.ui.screens.alerts

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.assetpulse.monitor.data.model.Alert
import com.assetpulse.monitor.data.remote.toApiException
import com.assetpulse.monitor.data.repository.MonitoringRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AlertsState(
    val isLoading: Boolean = true,
    val alerts: List<Alert> = emptyList(),
    val activeSeverity: String? = null,
    val selectedIds: Set<Int> = emptySet(),
    val isAcknowledging: Boolean = false,
    val staleSince: Long? = null,
    val error: String? = null,
) {
    val visibleAlerts: List<Alert>
        get() = alerts.filter { activeSeverity == null || it.severityKey == activeSeverity }

    val counts: Map<String, Int>
        get() = alerts.groupingBy { it.severityKey }.eachCount()

    val unacknowledgedCount: Int get() = alerts.count { !it.isAcknowledged }

    val isSelecting: Boolean get() = selectedIds.isNotEmpty()
}

@HiltViewModel
class AlertsViewModel @Inject constructor(
    private val repository: MonitoringRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(AlertsState())
    val state: StateFlow<AlertsState> = _state.asStateFlow()

    fun onSeverityChange(severity: String?) {
        _state.value = _state.value.copy(activeSeverity = severity)
    }

    fun toggleSelection(id: Int) {
        val current = _state.value.selectedIds
        _state.value = _state.value.copy(
            selectedIds = if (id in current) current - id else current + id,
        )
    }

    fun clearSelection() {
        _state.value = _state.value.copy(selectedIds = emptySet())
    }

    fun selectAllVisibleUnacknowledged() {
        val ids = _state.value.visibleAlerts.filter { !it.isAcknowledged }.map { it.id }.toSet()
        _state.value = _state.value.copy(selectedIds = ids)
    }

    fun refresh() {
        viewModelScope.launch {
            try {
                val snapshot = repository.getAlerts()
                _state.value = _state.value.copy(
                    isLoading = false,
                    alerts = snapshot.value,
                    staleSince = snapshot.staleSince,
                    error = null,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = e.toApiException().message,
                )
            }
        }
    }

    /** Acknowledges [ids], or the current selection when none are given. */
    fun acknowledge(ids: List<Int> = _state.value.selectedIds.toList()) {
        if (ids.isEmpty()) return
        viewModelScope.launch {
            _state.value = _state.value.copy(isAcknowledging = true, error = null)
            try {
                repository.acknowledgeAlerts(ids)
                _state.value = _state.value.copy(
                    isAcknowledging = false,
                    selectedIds = emptySet(),
                )
                refresh()
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isAcknowledging = false,
                    error = e.toApiException().message,
                )
            }
        }
    }
}
