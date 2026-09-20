package com.assetpulse.monitor.ui.util

import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberUpdatedState
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import kotlinx.coroutines.delay

/** Poll intervals, mirroring `src/config.js`. */
object PollIntervals {
    const val DEFAULT_MS = 30_000L
    const val CHAT_MS = 10_000L
    const val CONVERSATIONS_MS = 15_000L
    const val BADGE_MS = 30_000L
}

/**
 * Interval polling that stops when nobody is looking — the native counterpart
 * of `usePolling` in `src/hooks/usePolling.js`.
 *
 * The RN hook had to gate on both AppState *and* navigation focus, because
 * React Navigation keeps tab screens mounted after you navigate away, so every
 * screen's `setInterval` kept firing forever, including in the background.
 * Compose needs only the lifecycle half of that: a destination that is not
 * current is removed from composition, which cancels this effect outright.
 * [repeatOnLifecycle] then covers the backgrounding case.
 *
 * Fires once immediately on (re)entering RESUMED, so coming back to a screen
 * shows fresh data instead of a stale render plus a wait for the next tick.
 */
@Composable
fun PollingEffect(
    intervalMs: Long = PollIntervals.DEFAULT_MS,
    enabled: Boolean = true,
    immediate: Boolean = true,
    onTick: suspend () -> Unit,
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    // Callers pass a lambda whose identity changes every recomposition; holding
    // it this way keeps the effect keyed only to things that should genuinely
    // restart the timer, instead of refetching on every render.
    val currentTick by rememberUpdatedState(onTick)

    LaunchedEffect(lifecycleOwner, intervalMs, enabled, immediate) {
        if (!enabled) return@LaunchedEffect
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            if (immediate) {
                runCatching { currentTick() }
            }
            while (true) {
                delay(intervalMs)
                // A thrown tick must not kill the loop.
                runCatching { currentTick() }
            }
        }
    }
}
