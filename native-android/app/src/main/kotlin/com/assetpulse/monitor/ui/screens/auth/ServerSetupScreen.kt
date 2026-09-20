package com.assetpulse.monitor.ui.screens.auth

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.assetpulse.monitor.BuildConfig
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.assetpulse.monitor.ui.theme.AppTheme
import com.assetpulse.monitor.ui.theme.Shapes
import com.assetpulse.monitor.ui.theme.Spacing
import kotlin.math.roundToInt

/**
 * First-run screen: the user types their AssetPulse server address, it is
 * normalised to https and probed at /health, then saved.
 */
@Composable
fun ServerSetupScreen(
    onConfigured: (String) -> Unit,
    viewModel: ServerSetupViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = AppTheme.colors

    // Horizontal shake on a failed verify, as in the RN screen.
    val shakeOffset = remember { Animatable(0f) }
    LaunchedEffect(state.shakeTick) {
        if (state.shakeTick == 0) return@LaunchedEffect
        listOf(8f, -8f, 6f, 0f).forEach { target ->
            shakeOffset.animateTo(target, androidx.compose.animation.core.tween(60))
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.bg),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(horizontal = Spacing.xxl),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(colors.primaryBg),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Filled.Dns,
                    contentDescription = null,
                    tint = colors.primary,
                    modifier = Modifier.size(34.dp),
                )
            }

            Spacer(Modifier.height(Spacing.xl))

            Text(
                text = "Connect to your server",
                style = androidx.compose.material3.MaterialTheme.typography.headlineMedium,
                color = colors.text,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(Spacing.sm))

            Text(
                text = "Enter the address of your AssetPulse server to get started.",
                style = androidx.compose.material3.MaterialTheme.typography.bodyMedium,
                color = colors.textSub,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(Spacing.xxl))

            OutlinedTextField(
                value = state.input,
                onValueChange = viewModel::onInputChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .offset { IntOffset(shakeOffset.value.roundToInt(), 0) },
                placeholder = { Text("assetpulse.yourcompany.com", color = colors.textDim) },
                singleLine = true,
                shape = Shapes.md,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Uri,
                    imeAction = ImeAction.Go,
                    autoCorrectEnabled = false,
                ),
                keyboardActions = KeyboardActions(onGo = { if (state.canVerify) viewModel.verify() }),
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

            if (state.message.isNotBlank()) {
                Spacer(Modifier.height(Spacing.md))
                StatusLine(status = state.status, message = state.message)
            }

            if (state.status == ProbeStatus.OK && state.resolvedUrl.isNotBlank()) {
                Spacer(Modifier.height(Spacing.xs))
                Text(
                    text = state.resolvedUrl,
                    style = androidx.compose.material3.MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                    textAlign = TextAlign.Center,
                )
            }

            Spacer(Modifier.height(Spacing.xxl))

            if (state.status == ProbeStatus.OK) {
                Button(
                    onClick = { viewModel.connect(onConfigured) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = Shapes.md,
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = colors.primary,
                        contentColor = Color.White,
                    ),
                ) {
                    Text("Connect", fontWeight = FontWeight.Bold)
                }
            } else {
                Button(
                    onClick = viewModel::verify,
                    enabled = state.canVerify,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = Shapes.md,
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                        containerColor = colors.primary,
                        contentColor = Color.White,
                        disabledContainerColor = colors.cardAlt,
                        disabledContentColor = colors.textDim,
                    ),
                ) {
                    if (state.status == ProbeStatus.VERIFYING) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = Color.White,
                            strokeWidth = 2.dp,
                        )
                    } else {
                        Text("Verify connection", fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(Modifier.height(Spacing.xl))

            Text(
                // Debug builds honour a typed http:// so local dev servers are
                // reachable, so the blanket claim would be untrue there.
                text = if (BuildConfig.DEBUG) {
                    "Addresses use HTTPS unless you type http:// (debug build)."
                } else {
                    "Connections always use HTTPS."
                },
                style = androidx.compose.material3.MaterialTheme.typography.labelMedium,
                color = colors.textMuted,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun StatusLine(status: ProbeStatus, message: String) {
    val colors = AppTheme.colors
    val tint = when (status) {
        ProbeStatus.OK -> colors.online
        ProbeStatus.ERROR -> colors.offline
        else -> colors.textSub
    }
    androidx.compose.foundation.layout.Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        when (status) {
            ProbeStatus.OK -> Icon(Icons.Filled.CheckCircle, null, tint = tint, modifier = Modifier.size(16.dp))
            ProbeStatus.ERROR -> Icon(Icons.Filled.ErrorOutline, null, tint = tint, modifier = Modifier.size(16.dp))
            else -> Unit
        }
        Text(
            text = message,
            style = androidx.compose.material3.MaterialTheme.typography.bodySmall,
            color = tint,
        )
    }
}

