package com.assetpulse.monitor.ui.nav

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.assetpulse.monitor.data.model.User
import com.assetpulse.monitor.ui.SessionState
import com.assetpulse.monitor.ui.screens.auth.BiometricLockScreen
import com.assetpulse.monitor.ui.screens.auth.LoginScreen
import com.assetpulse.monitor.ui.screens.auth.ServerSetupScreen
import com.assetpulse.monitor.ui.screens.main.MainShell

/**
 * Root navigation — the auth gate only.
 *
 * The start destination is chosen from [SessionState] and the host is re-keyed
 * by the caller when that outcome changes, which is the same "render whichever
 * branch the session is in" model the RN navigator used. Everything behind
 * sign-in lives in [MainShell]'s own nested graph.
 */
@Composable
fun AppNavHost(
    session: SessionState,
    onLoggedIn: (User) -> Unit,
    onServerConfigured: (String) -> Unit,
    onBiometricUnlocked: () -> Unit,
    onSignOut: () -> Unit,
    onServerCleared: () -> Unit,
    navController: NavHostController = rememberNavController(),
) {
    val startDestination = when {
        !session.isServerConfigured -> Routes.SERVER_SETUP
        session.hasToken && session.biometricLocked -> Routes.BIOMETRIC_LOCK
        session.hasToken -> Routes.MAIN
        else -> Routes.LOGIN
    }

    NavHost(navController = navController, startDestination = startDestination) {

        composable(Routes.SERVER_SETUP) {
            ServerSetupScreen(onConfigured = onServerConfigured)
        }

        composable(Routes.LOGIN) {
            LoginScreen(
                serverUrl = session.serverUrl,
                onLoggedIn = onLoggedIn,
                onServerCleared = onServerCleared,
            )
        }

        composable(Routes.BIOMETRIC_LOCK) {
            BiometricLockScreen(
                onUnlocked = onBiometricUnlocked,
                onSignOut = onSignOut,
            )
        }

        composable(Routes.MAIN) {
            MainShell(
                user = session.user,
                serverUrl = session.serverUrl,
                onSignOut = onSignOut,
            )
        }
    }
}
