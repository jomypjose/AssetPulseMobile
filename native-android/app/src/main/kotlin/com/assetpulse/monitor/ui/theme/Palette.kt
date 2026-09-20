package com.assetpulse.monitor.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * AssetPulse design tokens, ported 1:1 from the React Native app's
 * `src/theme.js`. Every value here has a direct counterpart there, so the
 * native client renders the same palette as the Expo build and the web app.
 *
 * Material3's own [androidx.compose.material3.ColorScheme] is derived from
 * this in [AssetPulseTheme]; screens should prefer these tokens directly
 * (via `AppTheme.colors`) because the design system is wider than MD3's
 * role set — status, severity and accent families have no MD3 equivalent.
 */
data class AppColors(
    // Layered backgrounds
    val bg: Color,
    val surface: Color,
    val card: Color,
    val cardAlt: Color,
    val border: Color,
    val borderFaint: Color,
    // Typography
    val text: Color,
    val textSub: Color,
    val textMuted: Color,
    val textDim: Color,
    // Brand accent
    val primary: Color,
    val primaryLight: Color,
    val primaryDim: Color,
    val primaryBg: Color,
    // Status
    val online: Color,
    val onlineBg: Color,
    val onlineDim: Color,
    val offline: Color,
    val offlineBg: Color,
    val offlineDim: Color,
    val warning: Color,
    val warningBg: Color,
    val warningDim: Color,
    // Alert severity
    val critical: Color,
    val criticalBg: Color,
    val info: Color,
    val infoBg: Color,
    // Accent palette
    val cyan: Color,
    val cyanBg: Color,
    val teal: Color,
    val tealBg: Color,
    val purple: Color,
    val purpleBg: Color,
    val purpleDim: Color,
    val pink: Color,
    val pinkBg: Color,
    val isLight: Boolean,
)

val DarkColors = AppColors(
    bg = Color(0xFF080C14),
    surface = Color(0xFF0D1321),
    card = Color(0xFF111927),
    cardAlt = Color(0xFF162234),
    border = Color(0xFF1E2C3E),
    borderFaint = Color(0xFF131D2C),
    text = Color(0xFFE8EDF5),
    textSub = Color(0xFF8BA3BE),
    textMuted = Color(0xFF556A84),
    textDim = Color(0xFF2E4158),
    primary = Color(0xFFEF4444),
    primaryLight = Color(0xFFF87171),
    primaryDim = Color(0xFF4A1010),
    primaryBg = Color(0xFF1E0909),
    online = Color(0xFF20D9A0),
    onlineBg = Color(0xFF071A12),
    onlineDim = Color(0xFF0B2E1F),
    offline = Color(0xFFFF5C6E),
    offlineBg = Color(0xFF1E0A0D),
    offlineDim = Color(0xFF3A0E14),
    warning = Color(0xFFFFB224),
    warningBg = Color(0xFF1A1000),
    warningDim = Color(0xFF382300),
    critical = Color(0xFFFF5C6E),
    criticalBg = Color(0xFF1E0A0D),
    info = Color(0xFF60A5FA),
    infoBg = Color(0xFF0D1F3C),
    cyan = Color(0xFF22D4F0),
    cyanBg = Color(0xFF071820),
    teal = Color(0xFF14B89E),
    tealBg = Color(0xFF071816),
    purple = Color(0xFFA78BFA),
    purpleBg = Color(0xFF130D28),
    purpleDim = Color(0xFF261A4C),
    pink = Color(0xFFF472B6),
    pinkBg = Color(0xFF1C0C18),
    isLight = false,
)

val LightColors = AppColors(
    bg = Color(0xFFF4F6F9),
    surface = Color(0xFFFFFFFF),
    card = Color(0xFFFFFFFF),
    cardAlt = Color(0xFFF1F5F9),
    border = Color(0xFFDDE3EC),
    borderFaint = Color(0xFFEAEFF5),
    text = Color(0xFF0F172A),
    textSub = Color(0xFF4B5E7A),
    textMuted = Color(0xFF94A3B8),
    textDim = Color(0xFFCBD5E1),
    primary = Color(0xFFDC2626),
    primaryLight = Color(0xFFEF4444),
    primaryDim = Color(0xFFFECACA),
    primaryBg = Color(0xFFFEF2F2),
    online = Color(0xFF059669),
    onlineBg = Color(0xFFECFDF5),
    onlineDim = Color(0xFFD1FAE5),
    offline = Color(0xFFDC2626),
    offlineBg = Color(0xFFFEF2F2),
    offlineDim = Color(0xFFFECACA),
    warning = Color(0xFFD97706),
    warningBg = Color(0xFFFFFBEB),
    warningDim = Color(0xFFFDE68A),
    critical = Color(0xFFDC2626),
    criticalBg = Color(0xFFFEF2F2),
    info = Color(0xFF2563EB),
    infoBg = Color(0xFFEFF6FF),
    cyan = Color(0xFF0891B2),
    cyanBg = Color(0xFFECFEFF),
    teal = Color(0xFF0D9488),
    tealBg = Color(0xFFF0FDFA),
    purple = Color(0xFF7C3AED),
    purpleBg = Color(0xFFF5F3FF),
    purpleDim = Color(0xFFDDD6FE),
    pink = Color(0xFFDB2777),
    pinkBg = Color(0xFFFDF2F8),
    isLight = true,
)

/**
 * Header / bottom-nav palette that always renders dark, whatever the user's
 * light/dark preference — matching the web app, where the topbar and sidebar
 * stay dark in light mode too. Use for app chrome only; screen content uses
 * [AppColors].
 */
object Chrome {
    val bg = Color(0xFF1E2535)
    val bgDark = Color(0xFF0F1420)
    val border = Color(0x14FFFFFF)        // rgba(255,255,255,0.08)
    val borderFaint = Color(0x0DFFFFFF)   // rgba(255,255,255,0.05)
    val text = Color(0xFFE8EDF5)
    val textSub = Color(0xFFC8D4E8)
    val textMuted = Color(0xFF8BA3BE)
    val textDim = Color(0xFF556A84)
    val buttonBg = Color(0x0FFFFFFF)      // rgba(255,255,255,0.06)
    val buttonBorder = Color(0x1AFFFFFF)  // rgba(255,255,255,0.10)
}
