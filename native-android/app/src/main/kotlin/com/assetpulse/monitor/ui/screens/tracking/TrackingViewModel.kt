package com.assetpulse.monitor.ui.screens.tracking

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.assetpulse.monitor.data.model.HardwareAsset
import com.assetpulse.monitor.data.remote.toApiException
import com.assetpulse.monitor.data.repository.TrackingEnrollment
import com.assetpulse.monitor.data.repository.TrackingRepository
import com.assetpulse.monitor.tracking.TrackingPreferences
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** How often this device reports in. */
enum class ReportInterval(val label: String, val millis: Long) {
    FIVE_MIN("5 min", 300_000L),
    TEN_MIN("10 min", 600_000L),
    THIRTY_MIN("30 min", 1_800_000L),
    HOURLY("1 hour", 3_600_000L);

    companion object {
        fun nearest(millis: Long): ReportInterval =
            entries.minByOrNull { kotlin.math.abs(it.millis - millis) } ?: TEN_MIN
    }
}

data class TrackingState(
    val enrollment: TrackingEnrollment = TrackingEnrollment(false, -1, null, null, TrackingPreferences.DEFAULT_INTERVAL_MS),
    val query: String = "",
    val results: List<HardwareAsset> = emptyList(),
    val isSearching: Boolean = false,
    val isEnrolling: Boolean = false,
    val interval: ReportInterval = ReportInterval.TEN_MIN,
    val error: String? = null,
    val notice: String? = null,
) {
    val isEnrolled: Boolean get() = enrollment.assetLabel != null || enrollment.enabled
}

@HiltViewModel
class TrackingViewModel @Inject constructor(
    private val repository: TrackingRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(TrackingState())
    val state: StateFlow<TrackingState> = _state.asStateFlow()

    init {
        reloadEnrollment()
    }

    fun reloadEnrollment() {
        val enrollment = repository.currentEnrollment()
        _state.value = _state.value.copy(
            enrollment = enrollment,
            interval = ReportInterval.nearest(enrollment.intervalMs),
        )
    }

    fun onQueryChange(value: String) {
        _state.value = _state.value.copy(query = value, error = null)
    }

    fun onIntervalChange(interval: ReportInterval) {
        _state.value = _state.value.copy(interval = interval)
    }

    fun dismissNotice() {
        _state.value = _state.value.copy(notice = null, error = null)
    }

    fun search() {
        val query = _state.value.query
        if (query.isBlank()) return
        viewModelScope.launch {
            _state.value = _state.value.copy(isSearching = true, error = null)
            try {
                _state.value = _state.value.copy(
                    isSearching = false,
                    results = repository.searchAssets(query),
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isSearching = false,
                    error = e.toApiException().message,
                )
            }
        }
    }

    /**
     * Called only once the user has granted location permission — the screen
     * gates on that, because starting a location foreground service without
     * it fails on modern Android.
     */
    fun enroll(asset: HardwareAsset) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isEnrolling = true, error = null, notice = null)
            try {
                repository.enrollAndStart(asset, _state.value.interval.millis)
                _state.value = _state.value.copy(
                    isEnrolling = false,
                    results = emptyList(),
                    query = "",
                    notice = "This device is now tracked as ${asset.displayName}.",
                )
                reloadEnrollment()
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isEnrolling = false,
                    error = e.toApiException().message,
                )
            }
        }
    }

    fun resume() {
        repository.startService()
        reloadEnrollment()
    }

    fun pause() {
        repository.stopTracking()
        reloadEnrollment()
    }

    fun unenroll() {
        repository.unenroll()
        _state.value = _state.value.copy(notice = "Tracking removed from this device.")
        reloadEnrollment()
    }
}
