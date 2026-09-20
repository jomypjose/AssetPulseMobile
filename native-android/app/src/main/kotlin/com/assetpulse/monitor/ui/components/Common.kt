package com.assetpulse.monitor.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.assetpulse.monitor.data.model.DeviceStatus
import com.assetpulse.monitor.ui.theme.AppColors
import com.assetpulse.monitor.ui.theme.AppTheme
import com.assetpulse.monitor.ui.theme.Shapes
import com.assetpulse.monitor.ui.theme.Spacing

/** Colour triplet a status maps to, matching STATUS_CONFIG in the RN app. */
data class StatusPalette(val color: Color, val background: Color, val dim: Color)

@Composable
fun statusPalette(status: DeviceStatus): StatusPalette {
    val c = AppTheme.colors
    return when (status) {
        DeviceStatus.ONLINE -> StatusPalette(c.online, c.onlineBg, c.onlineDim)
        DeviceStatus.WARNING -> StatusPalette(c.warning, c.warningBg, c.warningDim)
        DeviceStatus.OFFLINE -> StatusPalette(c.offline, c.offlineBg, c.offlineDim)
        DeviceStatus.UNKNOWN -> StatusPalette(c.textDim, c.cardAlt, c.border)
    }
}

@Composable
fun severityPalette(severity: String): StatusPalette {
    val c = AppTheme.colors
    return when (severity.lowercase()) {
        "critical" -> StatusPalette(c.critical, c.criticalBg, c.critical)
        "warning" -> StatusPalette(c.warning, c.warningBg, c.warningDim)
        "info" -> StatusPalette(c.info, c.infoBg, c.info)
        else -> StatusPalette(c.textDim, c.cardAlt, c.border)
    }
}

/** Status dot; online pulses, as in the RN list. */
@Composable
fun StatusDot(status: DeviceStatus, size: Int = 9) {
    val palette = statusPalette(status)
    val pulse = if (status == DeviceStatus.ONLINE) {
        val transition = rememberInfiniteTransition(label = "pulse")
        val alpha by transition.animateFloat(
            initialValue = 1f,
            targetValue = 0.35f,
            animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
            label = "pulseAlpha",
        )
        alpha
    } else 1f

    Box(
        modifier = Modifier
            .size(size.dp)
            .alpha(pulse)
            .clip(CircleShape)
            .background(palette.color),
    )
}

/** Standard card surface used across the app. */
@Composable
fun AppCard(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val colors = AppTheme.colors
    Box(
        modifier = modifier
            .clip(Shapes.md)
            .background(colors.card)
            .border(1.dp, colors.borderFaint, Shapes.md),
    ) { content() }
}

/**
 * Banner shown when the screen is rendering a cached snapshot because the
 * server was unreachable.
 */
@Composable
fun StaleBanner(staleLabel: String, modifier: Modifier = Modifier) {
    val colors = AppTheme.colors
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(Shapes.sm)
            .background(colors.warningBg)
            .padding(horizontal = Spacing.md, vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        Box(
            modifier = Modifier
                .size(7.dp)
                .clip(CircleShape)
                .background(colors.warning),
        )
        Text(
            text = "Offline — showing data from $staleLabel",
            style = MaterialTheme.typography.bodySmall,
            color = colors.warning,
        )
    }
}

@Composable
fun EmptyState(
    icon: ImageVector,
    title: String,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
) {
    val colors = AppTheme.colors
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(Spacing.xxxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        Icon(icon, contentDescription = null, tint = colors.textDim, modifier = Modifier.size(40.dp))
        Spacer(Modifier.height(Spacing.xs))
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            color = colors.textSub,
            textAlign = TextAlign.Center,
        )
        subtitle?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
fun ErrorBanner(message: String, modifier: Modifier = Modifier) {
    val colors = AppTheme.colors
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(Shapes.sm)
            .background(colors.offlineBg)
            .padding(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodySmall,
            color = colors.offline,
        )
    }
}

/** Section heading used above lists and card groups. */
@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    trailing: @Composable (() -> Unit)? = null,
) {
    val colors: AppColors = AppTheme.colors
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            color = colors.textSub,
        )
        trailing?.invoke()
    }
}
