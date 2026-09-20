package com.assetpulse.monitor.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.assetpulse.monitor.ui.theme.AppTheme
import com.assetpulse.monitor.ui.theme.Spacing

/**
 * Ring gauge for a 0–100 percentage — the Compose equivalent of the RN
 * `CircularGauge` (which drew the same shape with react-native-svg).
 */
@Composable
fun CircularGauge(
    value: Int?,
    label: String,
    color: Color,
    modifier: Modifier = Modifier,
    size: Int = 110,
    strokeWidth: Int = 10,
) {
    val colors = AppTheme.colors
    val pct = (value ?: 0).coerceIn(0, 100)

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Canvas(modifier = Modifier.size(size.dp)) {
                val stroke = strokeWidth.dp.toPx()
                val inset = stroke / 2
                val arcSize = Size(this.size.width - stroke, this.size.height - stroke)
                val topLeft = Offset(inset, inset)

                drawArc(
                    color = colors.cardAlt,
                    startAngle = 135f,
                    sweepAngle = 270f,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = stroke, cap = androidx.compose.ui.graphics.StrokeCap.Round),
                )
                if (value != null) {
                    drawArc(
                        color = color,
                        startAngle = 135f,
                        sweepAngle = 270f * (pct / 100f),
                        useCenter = false,
                        topLeft = topLeft,
                        size = arcSize,
                        style = Stroke(width = stroke, cap = androidx.compose.ui.graphics.StrokeCap.Round),
                    )
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = value?.let { "$it%" } ?: "—",
                    style = MaterialTheme.typography.headlineSmall,
                    color = if (value != null) colors.text else colors.textDim,
                )
            }
        }
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = colors.textMuted,
        )
    }
}

/**
 * Compact trend line for a metric series, matching the RN `Sparkline`.
 * Renders nothing when there are fewer than two points to join.
 */
@Composable
fun Sparkline(
    data: List<Float>,
    label: String,
    color: Color,
    suffix: String = "",
    modifier: Modifier = Modifier,
) {
    if (data.size < 2) return
    val colors = AppTheme.colors
    val min = data.min()
    val max = data.max()
    val span = (max - min).takeIf { it > 0f } ?: 1f

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.xs),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = colors.textMuted,
            )
            Text(
                text = "${data.last().toInt()}$suffix",
                style = MaterialTheme.typography.labelLarge,
                color = color,
            )
        }
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(44.dp),
        ) {
            val stepX = size.width / (data.size - 1)
            val path = Path()
            data.forEachIndexed { index, raw ->
                val x = stepX * index
                val y = size.height - ((raw - min) / span) * size.height
                if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            drawPath(path, color = color, style = Stroke(width = 2.dp.toPx()))
        }
    }
}
