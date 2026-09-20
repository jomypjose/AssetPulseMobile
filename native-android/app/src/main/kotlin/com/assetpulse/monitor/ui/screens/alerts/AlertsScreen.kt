package com.assetpulse.monitor.ui.screens.alerts

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.assetpulse.monitor.data.model.Alert
import com.assetpulse.monitor.ui.components.AppCard
import com.assetpulse.monitor.ui.components.EmptyState
import com.assetpulse.monitor.ui.components.LoadingState
import com.assetpulse.monitor.ui.components.ErrorBanner
import com.assetpulse.monitor.ui.components.StaleBanner
import com.assetpulse.monitor.ui.components.severityPalette
import com.assetpulse.monitor.ui.theme.AppTheme
import com.assetpulse.monitor.ui.theme.Shapes
import com.assetpulse.monitor.ui.theme.Spacing
import com.assetpulse.monitor.ui.util.PollIntervals
import com.assetpulse.monitor.ui.util.PollingEffect

private val SEVERITIES = listOf("critical", "warning", "info")

@Composable
fun AlertsScreen(viewModel: AlertsViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = AppTheme.colors

    PollingEffect(intervalMs = PollIntervals.DEFAULT_MS) { viewModel.refresh() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.lg, vertical = Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Alerts",
                    style = MaterialTheme.typography.headlineSmall,
                    color = colors.text,
                )
                Text(
                    text = "${state.unacknowledgedCount} unacknowledged",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
            }
            if (state.unacknowledgedCount > 0 && !state.isSelecting) {
                TextButton(onClick = viewModel::selectAllVisibleUnacknowledged) {
                    Icon(
                        Icons.Filled.DoneAll,
                        contentDescription = null,
                        tint = colors.primary,
                        modifier = Modifier.size(16.dp),
                    )
                    Text(
                        text = " Select",
                        style = MaterialTheme.typography.labelMedium,
                        color = colors.primary,
                    )
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.lg),
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            SeverityChip(
                label = "All",
                count = state.alerts.size,
                color = colors.textSub,
                selected = state.activeSeverity == null,
                onClick = { viewModel.onSeverityChange(null) },
            )
            SEVERITIES.forEach { severity ->
                val palette = severityPalette(severity)
                SeverityChip(
                    label = severity.replaceFirstChar { it.uppercase() },
                    count = state.counts[severity] ?: 0,
                    color = palette.color,
                    selected = state.activeSeverity == severity,
                    onClick = { viewModel.onSeverityChange(severity) },
                )
            }
        }

        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            state.staleSince?.let { since ->
                item { StaleBanner(OfflineCache.formatStale(since)) }
            }
            state.error?.let { message ->
                item { ErrorBanner(message) }
            }

            val visible = state.visibleAlerts
            if (state.isLoading && state.alerts.isEmpty()) {
                item { LoadingState("Loading alerts…") }
            } else if (visible.isEmpty()) {
                item {
                    EmptyState(
                        icon = Icons.Filled.NotificationsNone,
                        title = "Nothing to see here",
                        subtitle = "Alerts raised by monitoring will show up here.",
                    )
                }
            } else {
                items(visible, key = { it.id }) { alert ->
                    AlertCard(
                        alert = alert,
                        selected = alert.id in state.selectedIds,
                        selectionActive = state.isSelecting,
                        onToggleSelect = { viewModel.toggleSelection(alert.id) },
                        onAcknowledge = { viewModel.acknowledge(listOf(alert.id)) },
                    )
                }
            }
        }

        if (state.isSelecting) {
            SelectionBar(
                count = state.selectedIds.size,
                busy = state.isAcknowledging,
                onCancel = viewModel::clearSelection,
                onAcknowledge = { viewModel.acknowledge() },
            )
        }
    }
}

@Composable
private fun AlertCard(
    alert: Alert,
    selected: Boolean,
    selectionActive: Boolean,
    onToggleSelect: () -> Unit,
    onAcknowledge: () -> Unit,
) {
    val colors = AppTheme.colors
    val palette = severityPalette(alert.severityKey)

    AppCard(
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (selected) Modifier.border(1.dp, palette.color, Shapes.md) else Modifier
            )
            .clickable {
                // Tapping joins the selection once one is running; otherwise
                // it acknowledges directly, matching the RN swipe shortcut.
                if (selectionActive || alert.isAcknowledged) onToggleSelect() else onAcknowledge()
            },
    ) {
        Column(modifier = Modifier.padding(Spacing.md)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            ) {
                Box(
                    modifier = Modifier
                        .clip(Shapes.xs)
                        .background(palette.background)
                        .padding(horizontal = Spacing.sm, vertical = 2.dp),
                ) {
                    Text(
                        text = alert.severityKey.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = palette.color,
                        fontWeight = FontWeight.Bold,
                    )
                }
                if (alert.isAcknowledged) {
                    Icon(
                        Icons.Filled.CheckCircle,
                        contentDescription = "Acknowledged",
                        tint = colors.online,
                        modifier = Modifier.size(14.dp),
                    )
                }
                Box(modifier = Modifier.weight(1f))
                alert.metric?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.labelMedium,
                        color = colors.textMuted,
                    )
                }
            }

            androidx.compose.foundation.layout.Spacer(Modifier.size(Spacing.sm))

            Text(
                text = alert.message ?: "Alert",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.text,
            )

            val subtitle = listOfNotNull(
                alert.deviceLabel,
                alert.deviceAddress,
                alert.branchLabel,
            ).filter { it.isNotBlank() }.distinct().joinToString(" · ")

            if (subtitle.isNotBlank()) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
            }
        }
    }
}

@Composable
private fun SelectionBar(
    count: Int,
    busy: Boolean,
    onCancel: () -> Unit,
    onAcknowledge: () -> Unit,
) {
    val colors = AppTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.surface)
            .padding(Spacing.lg),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Text(
            text = "$count selected",
            style = MaterialTheme.typography.titleSmall,
            color = colors.text,
            modifier = Modifier.weight(1f),
        )
        TextButton(onClick = onCancel, enabled = !busy) {
            Text("Cancel", color = colors.textMuted)
        }
        Button(
            onClick = onAcknowledge,
            enabled = !busy,
            colors = ButtonDefaults.buttonColors(
                containerColor = colors.primary,
                contentColor = Color.White,
            ),
        ) {
            Text(if (busy) "Working…" else "Acknowledge", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun SeverityChip(
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
