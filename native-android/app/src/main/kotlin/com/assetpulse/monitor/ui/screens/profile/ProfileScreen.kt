package com.assetpulse.monitor.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.assetpulse.monitor.data.model.User
import com.assetpulse.monitor.ui.components.AppCard
import com.assetpulse.monitor.ui.theme.AppTheme
import com.assetpulse.monitor.ui.theme.Shapes
import com.assetpulse.monitor.ui.theme.Spacing

/**
 * Minimal profile tab. The full settings screen (theme picker, biometric
 * toggle, server details) belongs to a later phase; this exists so the
 * signed-in user, asset tracking and sign-out have a home.
 */
@Composable
fun ProfileScreen(
    user: User?,
    serverUrl: String?,
    onOpenTracking: () -> Unit,
    onSignOut: () -> Unit,
) {
    val colors = AppTheme.colors

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg),
        contentPadding = PaddingValues(Spacing.lg),
        verticalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        item {
            AppCard(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(Spacing.lg),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                ) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(colors.primaryBg),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.Person,
                            contentDescription = null,
                            tint = colors.primary,
                            modifier = Modifier.size(24.dp),
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = user?.displayName?.takeIf { it.isNotBlank() } ?: "Signed in",
                            style = MaterialTheme.typography.titleMedium,
                            color = colors.text,
                        )
                        user?.role?.let {
                            Text(
                                text = it.replace('_', ' '),
                                style = MaterialTheme.typography.bodySmall,
                                color = colors.textMuted,
                            )
                        }
                    }
                }
            }
        }

        item {
            SettingsRow(
                icon = Icons.Filled.LocationOn,
                title = "Asset tracking",
                subtitle = "Report this device's location as a tracked asset",
                onClick = onOpenTracking,
            )
        }

        item {
            serverUrl?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.labelMedium,
                    color = colors.textMuted,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        item {
            TextButton(onClick = onSignOut, modifier = Modifier.fillMaxWidth()) {
                Icon(
                    Icons.AutoMirrored.Filled.Logout,
                    contentDescription = null,
                    tint = colors.offline,
                    modifier = Modifier.size(18.dp),
                )
                Text(" Sign out", color = colors.offline)
            }
        }
    }
}

@Composable
private fun SettingsRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    val colors = AppTheme.colors
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
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(Shapes.sm)
                    .background(colors.cardAlt),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = colors.primary, modifier = Modifier.size(18.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleSmall, color = colors.text)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = colors.textMuted)
            }
            Icon(
                Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = colors.textDim,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}
