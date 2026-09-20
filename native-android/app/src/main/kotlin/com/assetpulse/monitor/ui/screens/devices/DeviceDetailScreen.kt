package com.assetpulse.monitor.ui.screens.devices

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.assetpulse.monitor.ui.components.AppCard
import com.assetpulse.monitor.ui.components.CircularGauge
import com.assetpulse.monitor.ui.components.ErrorBanner
import com.assetpulse.monitor.ui.components.SectionHeader
import com.assetpulse.monitor.ui.components.Sparkline
import com.assetpulse.monitor.ui.components.StatusDot
import com.assetpulse.monitor.ui.theme.AppTheme
import com.assetpulse.monitor.ui.theme.Spacing
import com.assetpulse.monitor.ui.util.PollIntervals
import com.assetpulse.monitor.ui.util.PollingEffect
import com.assetpulse.monitor.util.Dates

@Composable
fun DeviceDetailScreen(
    onBack: () -> Unit,
    viewModel: DeviceDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = AppTheme.colors
    val device = state.device

    PollingEffect(intervalMs = PollIntervals.DEFAULT_MS) { viewModel.refresh() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.sm, vertical = Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = colors.text,
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = device?.displayName ?: "Device",
                    style = MaterialTheme.typography.titleLarge,
                    color = colors.text,
                    maxLines = 1,
                )
                device?.ipAddress?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                    )
                }
            }
            device?.let { StatusDot(it.status, size = 10) }
            androidx.compose.foundation.layout.Spacer(Modifier.size(Spacing.lg))
        }

        LazyColumn(
            contentPadding = PaddingValues(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.lg),
        ) {
            state.error?.let { message ->
                item { ErrorBanner(message) }
            }

            item {
                AppCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(Spacing.lg),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                    ) {
                        CircularGauge(
                            value = device?.cpuPercent,
                            label = "CPU",
                            color = gaugeColor(device?.cpuPercent),
                        )
                        CircularGauge(
                            value = device?.memoryPercent,
                            label = "Memory",
                            color = gaugeColor(device?.memoryPercent),
                        )
                    }
                }
            }

            if (state.metrics.hasAny) {
                item { SectionHeader("Trends") }
                item {
                    AppCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(Spacing.lg),
                            verticalArrangement = Arrangement.spacedBy(Spacing.lg),
                        ) {
                            Sparkline(
                                data = state.metrics.cpu,
                                label = "CPU %",
                                color = colors.primary,
                                suffix = "%",
                            )
                            Sparkline(
                                data = state.metrics.memory,
                                label = "Memory %",
                                color = colors.cyan,
                                suffix = "%",
                            )
                        }
                    }
                }
            }

            item { SectionHeader("Details") }
            item {
                AppCard(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(Spacing.lg),
                        verticalArrangement = Arrangement.spacedBy(Spacing.md),
                    ) {
                        InfoRow("Status", device?.status?.label ?: "—")
                        InfoRow("Hostname", device?.hostname ?: "—")
                        InfoRow("System name", device?.sysName ?: "—")
                        InfoRow("Location", device?.sysLocation ?: "—")
                        InfoRow("Uptime", device?.snmpUptime?.takeIf { it.isNotBlank() } ?: "—")
                        InfoRow("Last seen", Dates.relative(device?.lastSeen))
                        device?.extra?.cpuCount?.let {
                            InfoRow("CPU cores", it.toString())
                        }
                    }
                }
            }

            item {
                AppCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(Spacing.lg),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Maintenance mode",
                                style = MaterialTheme.typography.titleSmall,
                                color = colors.text,
                            )
                            Text(
                                text = "Suppresses alerts for this device.",
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.textMuted,
                            )
                        }
                        Switch(
                            checked = device?.maintenanceMode ?: false,
                            onCheckedChange = { viewModel.toggleMaintenance() },
                            enabled = device != null && !state.isTogglingMaintenance,
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = colors.primary,
                                checkedTrackColor = colors.primaryDim,
                            ),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    val colors = AppTheme.colors
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = colors.textMuted,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = colors.text,
        )
    }
}

@Composable
private fun gaugeColor(percent: Int?): Color {
    val colors = AppTheme.colors
    return when {
        percent == null -> colors.textDim
        percent >= 80 -> colors.offline
        percent >= 60 -> colors.warning
        else -> colors.online
    }
}

