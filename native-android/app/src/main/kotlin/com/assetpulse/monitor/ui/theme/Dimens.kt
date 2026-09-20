package com.assetpulse.monitor.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp

/** Spacing scale (4/8pt grid) — mirrors `S` in src/theme.js. */
object Spacing {
    val xs = 4.dp
    val sm = 8.dp
    val md = 12.dp
    val lg = 16.dp
    val xl = 20.dp
    val xxl = 24.dp
    val xxxl = 32.dp
    val xxxxl = 48.dp
}

/** Corner radii — mirrors `R` in src/theme.js. */
object Radii {
    val xs = 6.dp
    val sm = 10.dp
    val md = 14.dp
    val lg = 18.dp
    val xl = 22.dp
    val xxl = 28.dp
    val xxxl = 36.dp
    val full = 9999.dp
}

object Shapes {
    val xs = RoundedCornerShape(Radii.xs)
    val sm = RoundedCornerShape(Radii.sm)
    val md = RoundedCornerShape(Radii.md)
    val lg = RoundedCornerShape(Radii.lg)
    val xl = RoundedCornerShape(Radii.xl)
    val xxl = RoundedCornerShape(Radii.xxl)
    val full = RoundedCornerShape(Radii.full)
}
