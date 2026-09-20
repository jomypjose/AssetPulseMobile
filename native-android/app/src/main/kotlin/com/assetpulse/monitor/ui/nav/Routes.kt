package com.assetpulse.monitor.ui.nav

/**
 * Every destination in the app, declared up front so the graph is wired once
 * and later phases only swap a placeholder for the real screen.
 *
 * Mirrors the React Native navigator in `src/navigation/index.js`: a root
 * auth gate, a five-tab main shell, and per-tab stacks. Tools reachable from
 * both the Dashboard and Profile stacks appear once here — Compose
 * Navigation has no need to register them twice.
 */
object Routes {
    // Root / auth gate
    const val SERVER_SETUP = "server-setup"
    const val LOGIN = "login"
    const val BIOMETRIC_LOCK = "biometric-lock"
    const val MAIN = "main"

    // Bottom tabs
    const val DASHBOARD = "dashboard"
    const val DEVICES = "devices"
    const val ALERTS = "alerts"
    const val MESSAGES = "messages"
    const val PROFILE = "profile"

    // Devices
    const val DEVICE_DETAIL = "device/{id}"
    fun deviceDetail(id: Int) = "device/$id"

    // Branches & assets
    const val BRANCHES = "branches"
    const val BRANCH_DETAIL = "branch/{code}"
    fun branchDetail(code: String) = "branch/$code"
    const val BRANCH_ASSETS = "branch/{code}/assets/{kind}"
    fun branchAssets(code: String, kind: String) = "branch/$code/assets/$kind"
    const val ASSET_DETAIL = "asset/{kind}/{id}"
    fun assetDetail(kind: String, id: Int) = "asset/$kind/$id"
    const val ASSET_FORM = "asset-form/{kind}?id={id}"
    fun assetForm(kind: String, id: Int? = null) =
        "asset-form/$kind" + (id?.let { "?id=$it" } ?: "")

    // Tools
    const val SCANNER = "scanner"
    const val SEARCH = "search"
    const val MAP = "map"
    const val EXPIRY = "expiry"
    const val TICKETS = "tickets"
    const val DAILY_JOBS = "daily-jobs"

    // Messaging
    const val CHAT = "chat/{userId}?name={name}"
    fun chat(userId: Int, name: String) = "chat/$userId?name=$name"
}
