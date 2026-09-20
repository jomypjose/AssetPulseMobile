package com.assetpulse.monitor.ui.screens.devices

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.assetpulse.monitor.data.local.OfflineCache
import com.assetpulse.monitor.data.model.DeviceStatus
import com.assetpulse.monitor.ui.components.EmptyState
import com.assetpulse.monitor.ui.components.LoadingState
import com.assetpulse.monitor.ui.components.ErrorBanner
import com.assetpulse.monitor.ui.components.StaleBanner
import com.assetpulse.monitor.ui.screens.dashboard.DeviceRow
import com.assetpulse.monitor.ui.theme.AppTheme
import com.assetpulse.monitor.ui.theme.Shapes
import com.assetpulse.monitor.ui.theme.Spacing
import com.assetpulse.monitor.ui.util.PollIntervals
import com.assetpulse.monitor.ui.util.PollingEffect

@Composable
fun DevicesScreen(
    onOpenDevice: (Int) -> Unit,
    viewModel: DevicesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = AppTheme.colors

    PollingEffect(intervalMs = PollIntervals.DEFAULT_MS) { viewModel.refresh() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg),
    ) {
        OutlinedTextField(
            value = state.query,
            onValueChange = viewModel::onQueryChange,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.lg, vertical = Spacing.md),
            placeholder = { Text("Search devices", color = colors.textDim) },
            leadingIcon = {
                Icon(Icons.Filled.Search, contentDescription = null, tint = colors.textMuted)
            },
            singleLine = true,
            shape = Shapes.md,
            colors = TextFieldDefaults.colors(
                focusedContainerColor = colors.card,
                unfocusedContainerColor = colors.card,
                focusedTextColor = colors.text,
                unfocusedTextColor = colors.text,
                cursorColor = colors.primary,
                focusedIndicatorColor = colors.primary,
                unfocusedIndicatorColor = colors.border,
            ),
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.lg),
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            FilterChip(
                label = "All",
                count = state.devices.size,
                color = colors.textSub,
                selected = state.filter == null,
                onClick = { viewModel.onFilterChange(null) },
            )
            listOf(
                DeviceStatus.ONLINE to colors.online,
                DeviceStatus.WARNING to colors.warning,
                DeviceStatus.OFFLINE to colors.offline,
            ).forEach { (status, color) ->
                FilterChip(
                    label = status.label,
                    count = state.countFor(status),
                    color = color,
                    selected = state.filter == status,
                    onClick = { viewModel.onFilterChange(status) },
                )
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            state.staleSince?.let { since ->
                item { StaleBanner(OfflineCache.formatStale(since)) }
            }
            state.error?.let { message ->
                item { ErrorBanner(message) }
            }

            val visible = state.visibleDevices
            if (state.isLoading && state.devices.isEmpty()) {
                item { LoadingState("Loading devices…") }
            } else if (visible.isEmpty()) {
                item {
                    EmptyState(
                        icon = Icons.Filled.Dns,
                        title = if (state.query.isBlank()) "No monitored devices" else "No matches",
                        subtitle = if (state.query.isBlank()) {
                            "Devices will appear here once monitoring picks them up."
                        } else {
                            "Try a different name, address or location."
                        },
                    )
                }
            } else {
                items(visible, key = { it.id }) { device ->
                    DeviceRow(device = device, onClick = { onOpenDevice(device.id) })
                }
            }
        }
    }
}

@Composable
private fun FilterChip(
    label: String,
    count: Int,
    color: Color,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val colors = AppTheme.colors
    Row(
        modifier = Modifier
            .clip(Shapes.full)
            .background(if (selected) color.copy(alpha = 0.16f) else colors.card)
            .clickable(onClick = onClick)
            .padding(horizontal = Spacing.md, vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.xs),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = if (selected) color else colors.textSub,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
        )
        Text(
            text = count.toString(),
            style = MaterialTheme.typography.labelSmall,
            color = if (selected) color else colors.textMuted,
        )
    }
}
