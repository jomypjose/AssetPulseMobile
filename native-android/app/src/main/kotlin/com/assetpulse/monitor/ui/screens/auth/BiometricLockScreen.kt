package com.assetpulse.monitor.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import com.assetpulse.monitor.ui.theme.AppTheme
import com.assetpulse.monitor.ui.theme.Shapes
import com.assetpulse.monitor.ui.theme.Spacing
import com.assetpulse.monitor.util.BiometricHelper
import com.assetpulse.monitor.util.findFragmentActivity
import kotlinx.coroutines.launch

/**
 * Shown when a stored session exists but the biometric app-lock is on.
 * Prompts automatically on first composition, as the RN screen did, with a
 * manual retry and a "sign out instead" escape hatch.
 */
@Composable
fun BiometricLockScreen(
    onUnlocked: () -> Unit,
    onSignOut: () -> Unit,
) {
    val colors = AppTheme.colors
    val activity = LocalContext.current.findFragmentActivity()
    val scope = rememberCoroutineScope()
    var denied by remember { mutableStateOf(false) }

    fun prompt() {
        val host = activity ?: return
        scope.launch {
            val ok = BiometricHelper.authenticate(host)
            if (ok) onUnlocked() else denied = true
        }
    }

    // Auto-prompt once on entry.
    LaunchedEffect(Unit) { prompt() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = Spacing.xxl),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(
                modifier = Modifier
                    .size(84.dp)
                    .clip(CircleShape)
                    .background(colors.primaryBg),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Filled.Fingerprint,
                    contentDescription = null,
                    tint = colors.primary,
                    modifier = Modifier.size(42.dp),
                )
            }

            Spacer(Modifier.height(Spacing.xl))

            Text(
                text = "AssetPulse is locked",
                style = MaterialTheme.typography.headlineSmall,
                color = colors.text,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(Spacing.sm))

            Text(
                text = if (denied) {
                    "Unlock failed. Try again to continue."
                } else {
                    "Verify your identity to continue."
                },
                style = MaterialTheme.typography.bodyMedium,
                color = if (denied) colors.offline else colors.textSub,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(Spacing.xxl))

            Button(
                onClick = { prompt() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = Shapes.md,
                colors = ButtonDefaults.buttonColors(
                    containerColor = colors.primary,
                    contentColor = Color.White,
                ),
            ) {
                Text("Unlock", fontWeight = FontWeight.Bold)
            }

            TextButton(onClick = onSignOut) {
                Text(
                    "Sign out instead",
                    style = MaterialTheme.typography.labelMedium,
                    color = colors.textMuted,
                )
            }
        }
    }
}
