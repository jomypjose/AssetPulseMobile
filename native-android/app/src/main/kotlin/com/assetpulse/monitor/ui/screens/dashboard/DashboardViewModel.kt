package com.assetpulse.monitor.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.assetpulse.monitor.data.model.Alert
import com.assetpulse.monitor.data.model.DashboardStats
import com.assetpulse.monitor.data.model.Device
import com.assetpulse.monitor.data.remote.toApiException
import com.assetpulse.monitor.data.repository.MonitoringRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DashboardState(
    val isLoading: Boolean = true,
    val stats: DashboardStats = DashboardStats(),
    val devices: List<Device> = emptyList(),
    val alerts: List<Alert> = emptyList(),
    val staleSince: Long? = null,
    val error: String? = null,
) {
    val unacknowledgedAlerts: List<Alert> get() = alerts.filter { !it.isAcknowledged }
    val recentDevices: List<Device> get() = devices.take(4)
}

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val repository: MonitoringRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(DashboardState())
    val state: StateFlow<DashboardState> = _state.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            try {
                // Stats, devices and alerts are independent; fetch together so
                // a tick costs one round trip's latency rather than three.
                val statsJob = async { runCatching { repository.getDashboardStats() }.getOrNull() }
                val devicesJob = async { repository.getDevices() }
                val alertsJob = async { repository.getAlerts() }

                val devices = devicesJob.await()
                val alerts = alertsJob.await()

                _state.value = DashboardState(
                    isLoading = false,
                    stats = statsJob.await() ?: _state.value.stats,
                    devices = devices.value,
                    alerts = alerts.value,
                    staleSince = devices.staleSince ?: alerts.staleSince,
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
}
