package com.assetpulse.monitor.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.assetpulse.monitor.data.local.OfflineCache
import com.assetpulse.monitor.data.model.Device
import com.assetpulse.monitor.ui.components.AppCard
import com.assetpulse.monitor.ui.components.EmptyState
import com.assetpulse.monitor.ui.components.ErrorBanner
import com.assetpulse.monitor.ui.components.SectionHeader
import com.assetpulse.monitor.ui.components.StaleBanner
import com.assetpulse.monitor.ui.components.StatusDot
import com.assetpulse.monitor.ui.components.statusPalette
import com.assetpulse.monitor.ui.theme.AppTheme
import com.assetpulse.monitor.ui.theme.Shapes
import com.assetpulse.monitor.ui.theme.Spacing
import com.assetpulse.monitor.ui.util.PollIntervals
import com.assetpulse.monitor.ui.util.PollingEffect

@Composable
fun DashboardScreen(
    userName: String,
    onOpenDevices: () -> Unit,
    onOpenAlerts: () -> Unit,
    onOpenDevice: (Int) -> Unit,
    viewModel: DashboardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = AppTheme.colors

    PollingEffect(intervalMs = PollIntervals.DEFAULT_MS) { viewModel.refresh() }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg),
        contentPadding = PaddingValues(Spacing.lg),
        verticalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        item {
            Column {
                Text(
                    text = "Hello, $userName",
                    style = MaterialTheme.typography.headlineSmall,
                    color = colors.text,
                )
                Text(
                    text = "Here's what your network looks like.",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
            }
        }

        state.staleSince?.let { since ->
            item { StaleBanner(OfflineCache.formatStale(since)) }
        }

        state.error?.let { message ->
            item { ErrorBanner(message) }
        }

        item {
            val monitoring = state.stats.monitoring
            HealthSummary(
                online = monitoring.online,
                warning = monitoring.warning,
                offline = monitoring.offline,
                total = monitoring.total,
            )
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
                KpiCard(
                    icon = Icons.Filled.Dns,
                    value = state.stats.monitoring.total,
                    label = "Devices",
                    color = colors.primary,
                    modifier = Modifier.weight(1f),
                    onClick = onOpenDevices,
                )
                KpiCard(
                    icon = Icons.Filled.Notifications,
                    value = state.unacknowledgedAlerts.size,
                    label = "Alerts",
                    color = colors.offline,
                    modifier = Modifier.weight(1f),
                    onClick = onOpenAlerts,
                )
                KpiCard(
                    icon = Icons.Filled.ConfirmationNumber,
                    value = state.stats.tickets.pending,
                    label = "Tickets",
                    color = colors.warning,
                    modifier = Modifier.weight(1f),
                    onClick = {},
                )
            }
        }

        item {
            SectionHeader(
                title = "Devices",
                trailing = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable(onClick = onOpenDevices),
                    ) {
                        Text(
                            text = "See all",
                            style = MaterialTheme.typography.labelMedium,
                            color = colors.primary,
                        )
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            tint = colors.primary,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                },
            )
        }

        if (state.recentDevices.isEmpty() && !state.isLoading) {
            item {
                EmptyState(
                    icon = Icons.Filled.Dns,
                    title = "No monitored devices",
                    subtitle = "Devices will appear here once monitoring picks them up.",
                )
            }
        } else {
            items(state.recentDevices, key = { it.id }) { device ->
                DeviceRow(device = device, onClick = { onOpenDevice(device.id) })
            }
        }
    }
}

@Composable
private fun HealthSummary(online: Int, warning: Int, offline: Int, total: Int) {
    val colors = AppTheme.colors
    val percent = if (total > 0) (online * 100) / total else 0
    val ringColor = when {
        percent >= 90 -> colors.online
        percent >= 70 -> colors.warning
        else -> colors.offline
    }

    AppCard(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Spacing.lg),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.xl),
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "$percent%",
                    style = MaterialTheme.typography.headlineMedium,
                    color = ringColor,
                )
                Text(
                    text = "healthy",
                    style = MaterialTheme.typography.labelMedium,
                    color = colors.textMuted,
                )
            }
            Column(
                verticalArrangement = Arrangement.spacedBy(Spacing.sm),
                modifier = Modifier.weight(1f),
            ) {
                LegendRow("Online", online, colors.online)
                LegendRow("Warning", warning, colors.warning)
                LegendRow("Offline", offline, colors.offline)
            }
        }
    }
}

@Composable
private fun LegendRow(label: String, count: Int, color: Color) {
    val colors = AppTheme.colors
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color),
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = colors.textSub,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = count.toString(),
            style = MaterialTheme.typography.labelLarge,
            color = colors.text,
        )
    }
}

@Composable
private fun KpiCard(
    icon: ImageVector,
    value: Int,
    label: String,
    color: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val colors = AppTheme.colors
    AppCard(modifier = modifier.clickable(onClick = onClick)) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = Spacing.lg, horizontal = Spacing.md),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.xs),
        ) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
            Text(
                text = value.toString(),
                style = MaterialTheme.typography.headlineSmall,
                color = colors.text,
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = colors.textMuted,
            )
        }
    }
}

@Composable
fun DeviceRow(device: Device, onClick: () -> Unit) {
    val colors = AppTheme.colors
    val palette = statusPalette(device.status)

    AppCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            StatusDot(device.status)

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = device.displayName,
                    style = MaterialTheme.typography.titleSmall,
                    color = colors.text,
                    maxLines = 1,
                )
                Text(
                    text = listOfNotNull(device.ipAddress, device.sysLocation)
                        .joinToString(" · ")
                        .ifBlank { "No address" },
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                    maxLines = 1,
                )
            }

            Box(
                modifier = Modifier
                    .clip(Shapes.xs)
                    .background(palette.background)
                    .padding(horizontal = Spacing.sm, vertical = 3.dp),
            ) {
                Text(
                    text = device.status.label,
                    style = MaterialTheme.typography.labelSmall,
                    color = palette.color,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}
