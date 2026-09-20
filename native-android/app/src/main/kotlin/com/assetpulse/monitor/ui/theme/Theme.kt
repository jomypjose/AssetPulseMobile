package com.assetpulse.monitor.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/** User's theme preference, persisted in DataStore. Mirrors ThemeContext.js. */
enum class ThemeMode { SYSTEM, LIGHT, DARK;

    companion object {
        fun fromStored(value: String?): ThemeMode = when (value?.lowercase()) {
            "light" -> LIGHT
            "dark" -> DARK
            else -> SYSTEM
        }
    }

    val stored: String get() = name.lowercase()
}

val LocalAppColors = staticCompositionLocalOf { DarkColors }

object AppTheme {
    val colors: AppColors
        @Composable @ReadOnlyComposable get() = LocalAppColors.current
}

/**
 * Root theme. Unlike the RN app — which had to mutate a shared `C` object and
 * remount the whole tree on every theme change because `StyleSheet.create`
 * freezes colours at call time — Compose reads colours through a
 * CompositionLocal, so a theme switch is just a normal recomposition.
 */
@Composable
fun AssetPulseTheme(
    mode: ThemeMode = ThemeMode.SYSTEM,
    content: @Composable () -> Unit,
) {
    val useDark = when (mode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val colors = if (useDark) DarkColors else LightColors

    // MD3 scheme derived from the design tokens so stock Material components
    // (TextField, Snackbar, etc.) sit correctly on our surfaces.
    val material = if (useDark) {
        darkColorScheme(
            primary = colors.primary,
            onPrimary = Color.White,
            primaryContainer = colors.primaryDim,
            onPrimaryContainer = colors.primaryLight,
            secondary = colors.info,
            tertiary = colors.purple,
            background = colors.bg,
            onBackground = colors.text,
            surface = colors.card,
            onSurface = colors.text,
            surfaceVariant = colors.cardAlt,
            onSurfaceVariant = colors.textSub,
            outline = colors.border,
            outlineVariant = colors.borderFaint,
            error = colors.critical,
            onError = Color.White,
            errorContainer = colors.criticalBg,
            onErrorContainer = colors.critical,
        )
    } else {
        lightColorScheme(
            primary = colors.primary,
            onPrimary = Color.White,
            primaryContainer = colors.primaryDim,
            onPrimaryContainer = colors.primary,
            secondary = colors.info,
            tertiary = colors.purple,
            background = colors.bg,
            onBackground = colors.text,
            surface = colors.card,
            onSurface = colors.text,
            surfaceVariant = colors.cardAlt,
            onSurfaceVariant = colors.textSub,
            outline = colors.border,
            outlineVariant = colors.borderFaint,
            error = colors.critical,
            onError = Color.White,
            errorContainer = colors.criticalBg,
            onErrorContainer = colors.critical,
        )
    }

    CompositionLocalProvider(LocalAppColors provides colors) {
        MaterialTheme(
            colorScheme = material,
            typography = AppTypography,
            content = content,
        )
    }
}

