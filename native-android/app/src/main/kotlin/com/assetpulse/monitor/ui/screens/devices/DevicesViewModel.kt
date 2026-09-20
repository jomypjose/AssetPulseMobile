package com.assetpulse.monitor.ui.screens.devices

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.assetpulse.monitor.data.model.Device
import com.assetpulse.monitor.data.model.DeviceStatus
import com.assetpulse.monitor.data.remote.toApiException
import com.assetpulse.monitor.data.repository.MonitoringRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DevicesState(
    val isLoading: Boolean = true,
    val devices: List<Device> = emptyList(),
    val query: String = "",
    val filter: DeviceStatus? = null,
    val staleSince: Long? = null,
    val error: String? = null,
) {
    /**
     * Search, then filter, then group Online → Warning → Offline → anything
     * else, which is the order the RN list used.
     */
    val visibleDevices: List<Device>
        get() {
            val needle = query.trim().lowercase()
            return devices
                .filter { device ->
                    needle.isEmpty() ||
                        listOfNotNull(
                            device.hostname,
                            device.sysName,
                            device.ipAddress,
                            device.sysLocation,
                        ).any { it.lowercase().contains(needle) }
                }
                .filter { filter == null || it.status == filter }
                .sortedWith(compareBy({ STATUS_ORDER.indexOf(it.status) }, { it.displayName }))
        }

    fun countFor(status: DeviceStatus): Int = devices.count { it.status == status }

    private companion object {
        val STATUS_ORDER = listOf(
            DeviceStatus.ONLINE,
            DeviceStatus.WARNING,
            DeviceStatus.OFFLINE,
            DeviceStatus.UNKNOWN,
        )
    }
}

@HiltViewModel
class DevicesViewModel @Inject constructor(
    private val repository: MonitoringRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(DevicesState())
    val state: StateFlow<DevicesState> = _state.asStateFlow()

    fun onQueryChange(value: String) {
        _state.value = _state.value.copy(query = value)
    }

    fun onFilterChange(status: DeviceStatus?) {
        _state.value = _state.value.copy(filter = status)
    }

    fun refresh() {
        viewModelScope.launch {
            try {
                val snapshot = repository.getDevices()
                _state.value = _state.value.copy(
                    isLoading = false,
                    devices = snapshot.value,
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
}
