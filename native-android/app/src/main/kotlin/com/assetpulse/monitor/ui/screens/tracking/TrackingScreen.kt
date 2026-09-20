package com.assetpulse.monitor.ui.screens.tracking

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.assetpulse.monitor.data.model.HardwareAsset
import com.assetpulse.monitor.ui.components.AppCard
import com.assetpulse.monitor.ui.components.ErrorBanner
import com.assetpulse.monitor.ui.components.SectionHeader
import com.assetpulse.monitor.ui.theme.AppTheme
import com.assetpulse.monitor.ui.theme.Shapes
import com.assetpulse.monitor.ui.theme.Spacing

/**
 * Enrolls this device as a tracked AssetPulse asset.
 *
 * Background location is intrusive, so nothing is requested until the person
 * has read what will be collected and tapped through deliberately. Permission
 * is asked in the order Android requires: foreground location first, then
 * background as a separate grant.
 */
@Composable
fun TrackingScreen(
    onBack: () -> Unit,
    viewModel: TrackingViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = AppTheme.colors
    val context = LocalContext.current

    var pendingAsset by remember { mutableStateOf<HardwareAsset?>(null) }
    var showBackgroundHint by remember { mutableStateOf(false) }

    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* The service still runs if declined; only the notification is hidden. */ }

    val locationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { granted ->
        val fine = granted[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarse = granted[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (fine || coarse) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            pendingAsset?.let { viewModel.enroll(it) }
            pendingAsset = null
            // Android 10+ will not grant background location in the same
            // prompt; it has to be chosen in Settings as "Allow all the time".
            showBackgroundHint = !context.hasBackgroundLocation()
        } else {
            pendingAsset = null
        }
    }

    fun beginEnroll(asset: HardwareAsset) {
        if (context.hasForegroundLocation()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            viewModel.enroll(asset)
            showBackgroundHint = !context.hasBackgroundLocation()
        } else {
            pendingAsset = asset
            locationLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                ),
            )
        }
    }

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
            Text(
                text = "Asset tracking",
                style = MaterialTheme.typography.titleLarge,
                color = colors.text,
            )
        }

        LazyColumn(
            contentPadding = PaddingValues(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.lg),
        ) {
            state.error?.let { item { ErrorBanner(it) } }
            state.notice?.let { item { NoticeBanner(it, onDismiss = viewModel::dismissNotice) } }

            if (state.isEnrolled) {
                item { EnrolledCard(state = state, viewModel = viewModel) }
                if (showBackgroundLocationWarning(state, context, showBackgroundHint)) {
                    item { BackgroundLocationCard(context) }
                }
            } else {
                item { DisclosureCard() }
                item { IntervalPicker(state, viewModel) }
                item { SectionHeader("Which asset is this device?") }
                item { AssetSearchField(state, viewModel) }

                if (state.isSearching) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(Spacing.lg),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = colors.primary,
                                strokeWidth = 2.dp,
                            )
                        }
                    }
                }

                items(state.results, key = { it.id }) { asset ->
                    AssetRow(
                        asset = asset,
                        enabled = !state.isEnrolling,
                        onClick = { beginEnroll(asset) },
                    )
                }
            }
        }
    }
}

@Composable
private fun DisclosureCard() {
    val colors = AppTheme.colors
    AppCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            ) {
                Icon(
                    Icons.Filled.LocationOn,
                    contentDescription = null,
                    tint = colors.primary,
                    modifier = Modifier.size(18.dp),
                )
                Text(
                    text = "Before you turn this on",
                    style = MaterialTheme.typography.titleSmall,
                    color = colors.text,
                )
            }
            Text(
                text = "This device will report its location to your AssetPulse server " +
                    "on a schedule, including while the app is closed, along with its " +
                    "battery level, memory and storage use, and uptime.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSub,
            )
            Text(
                text = "A permanent notification stays in your status bar while tracking " +
                    "is on. You can pause or remove tracking here at any time.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
            )
        }
    }
}

@Composable
private fun IntervalPicker(state: TrackingState, viewModel: TrackingViewModel) {
    val colors = AppTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
        SectionHeader("Report every")
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            ReportInterval.entries.forEach { interval ->
                val selected = state.interval == interval
                Box(
                    modifier = Modifier
                        .clip(Shapes.full)
                        .background(if (selected) colors.primaryBg else colors.card)
                        .clickable { viewModel.onIntervalChange(interval) }
                        .padding(horizontal = Spacing.md, vertical = Spacing.sm),
                ) {
                    Text(
                        text = interval.label,
                        style = MaterialTheme.typography.labelMedium,
                        color = if (selected) colors.primary else colors.textSub,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                    )
                }
            }
        }
    }
}

@Composable
private fun AssetSearchField(state: TrackingState, viewModel: TrackingViewModel) {
    val colors = AppTheme.colors
    OutlinedTextField(
        value = state.query,
        onValueChange = viewModel::onQueryChange,
        modifier = Modifier.fillMaxWidth(),
        placeholder = { Text("Search by asset ID, serial or owner", color = colors.textDim) },
        leadingIcon = { Icon(Icons.Filled.Search, null, tint = colors.textMuted) },
        singleLine = true,
        shape = Shapes.md,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { viewModel.search() }),
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
}

@Composable
private fun AssetRow(asset: HardwareAsset, enabled: Boolean, onClick: () -> Unit) {
    val colors = AppTheme.colors
    AppCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = enabled, onClick = onClick),
    ) {
        Column(modifier = Modifier.padding(Spacing.md)) {
            Text(
                text = asset.displayName,
                style = MaterialTheme.typography.titleSmall,
                color = colors.text,
            )
            if (asset.subtitle.isNotBlank()) {
                Text(
                    text = asset.subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )
            }
        }
    }
}

@Composable
private fun EnrolledCard(state: TrackingState, viewModel: TrackingViewModel) {
    val colors = AppTheme.colors
    val active = state.enrollment.enabled

    AppCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            ) {
                Box(
                    modifier = Modifier
                        .size(9.dp)
                        .clip(Shapes.full)
                        .background(if (active) colors.online else colors.textDim),
                )
                Text(
                    text = if (active) "Tracking is on" else "Tracking is paused",
                    style = MaterialTheme.typography.titleSmall,
                    color = colors.text,
                )
            }

            state.enrollment.assetLabel?.let {
                Text(
                    text = "Reporting as $it every ${state.interval.label}.",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textSub,
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                if (active) {
                    OutlinedButton(onClick = viewModel::pause, shape = Shapes.sm) {
                        Text("Pause", color = colors.textSub)
                    }
                } else {
                    Button(
                        onClick = viewModel::resume,
                        shape = Shapes.sm,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = colors.primary,
                            contentColor = Color.White,
                        ),
                    ) { Text("Resume") }
                }
                TextButton(onClick = viewModel::unenroll) {
                    Text("Remove", color = colors.offline)
                }
            }
        }
    }
}

@Composable
private fun BackgroundLocationCard(context: Context) {
    val colors = AppTheme.colors
    AppCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Text(
                text = "Allow location all the time",
                style = MaterialTheme.typography.titleSmall,
                color = colors.warning,
            )
            Text(
                text = "Android only grants background location from the system " +
                    "settings. Without it, this device stops reporting shortly after " +
                    "you leave the app.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSub,
            )
            Spacer(Modifier.height(Spacing.xs))
            OutlinedButton(
                onClick = {
                    context.startActivity(
                        Intent(
                            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.fromParts("package", context.packageName, null),
                        ),
                    )
                },
                shape = Shapes.sm,
            ) {
                Text("Open settings", color = colors.primary)
            }
        }
    }
}

@Composable
private fun NoticeBanner(message: String, onDismiss: () -> Unit) {
    val colors = AppTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(Shapes.sm)
            .background(colors.onlineBg)
            .clickable(onClick = onDismiss)
            .padding(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodySmall,
            color = colors.online,
        )
    }
}

private fun showBackgroundLocationWarning(
    state: TrackingState,
    context: Context,
    hinted: Boolean,
): Boolean = state.enrollment.enabled && (hinted || !context.hasBackgroundLocation())

private fun Context.hasForegroundLocation(): Boolean =
    ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED

private fun Context.hasBackgroundLocation(): Boolean =
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        hasForegroundLocation()
    } else {
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
    }
