package com.assetpulse.monitor.ui.screens.devices

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.assetpulse.monitor.data.model.Device
import com.assetpulse.monitor.data.remote.toApiException
import com.assetpulse.monitor.data.repository.DeviceMetrics
import com.assetpulse.monitor.data.repository.MonitoringRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DeviceDetailState(
    val isLoading: Boolean = true,
    val device: Device? = null,
    val metrics: DeviceMetrics = DeviceMetrics(),
    val isTogglingMaintenance: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class DeviceDetailViewModel @Inject constructor(
    private val repository: MonitoringRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val deviceId: Int = checkNotNull(savedStateHandle.get<String>("id")?.toIntOrNull()) {
        "DeviceDetail requires an id argument"
    }

    private val _state = MutableStateFlow(DeviceDetailState())
    val state: StateFlow<DeviceDetailState> = _state.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            try {
                // See DashboardViewModel: bare `async` children escalate a
                // failure to the parent job and crash the process, so the
                // parallel section is contained in a `coroutineScope`.
                val (device, metrics) = coroutineScope {
                    val deviceJob = async { repository.getDeviceDetail(deviceId) }
                    val metricsJob = async { repository.getDeviceMetrics(deviceId) }
                    deviceJob.await() to metricsJob.await()
                }
                _state.value = _state.value.copy(
                    isLoading = false,
                    device = device,
                    metrics = metrics,
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

    fun toggleMaintenance() {
        val device = _state.value.device ?: return
        val next = !(device.maintenanceMode ?: false)
        viewModelScope.launch {
            _state.value = _state.value.copy(isTogglingMaintenance = true, error = null)
            try {
                repository.setMaintenanceMode(deviceId, next)
                _state.value = _state.value.copy(
                    isTogglingMaintenance = false,
                    device = device.copy(maintenanceMode = next),
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isTogglingMaintenance = false,
                    error = e.toApiException().message,
                )
            }
        }
    }
}
