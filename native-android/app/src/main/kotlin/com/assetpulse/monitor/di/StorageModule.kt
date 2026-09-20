package com.assetpulse.monitor.di

import com.assetpulse.monitor.data.local.SecureTokenStore
import com.assetpulse.monitor.data.local.TokenStore
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class StorageModule {

    @Binds
    @Singleton
    abstract fun bindTokenStore(impl: SecureTokenStore): TokenStore
}
