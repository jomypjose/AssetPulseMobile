package com.assetpulse.monitor.data.local

/**
 * Access/refresh token storage.
 *
 * An interface so the refresh logic — the one piece of this client that must
 * be provably correct under concurrency — can be exercised in plain JVM unit
 * tests without Android's Keystore.
 */
interface TokenStore {
    var accessToken: String?
    var refreshToken: String?
    fun clear()
}
