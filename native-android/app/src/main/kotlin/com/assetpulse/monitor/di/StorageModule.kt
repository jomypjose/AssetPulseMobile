package com.assetpulse.monitor.di

import android.content.Context
import androidx.room.Room
import com.assetpulse.monitor.data.local.CacheDao
import com.assetpulse.monitor.data.local.CacheDatabase
import com.assetpulse.monitor.data.local.SecureTokenStore
import com.assetpulse.monitor.data.local.TokenStore
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class StorageModule {

    @Binds
    @Singleton
    abstract fun bindTokenStore(impl: SecureTokenStore): TokenStore

    companion object {

        @Provides
        @Singleton
        fun provideCacheDatabase(@ApplicationContext context: Context): CacheDatabase =
            Room.databaseBuilder(context, CacheDatabase::class.java, "assetpulse-cache.db")
                // The cache is disposable by definition; rebuilding it beats
                // shipping migrations for snapshots we can refetch.
                .fallbackToDestructiveMigration()
                .build()

        @Provides
        @Singleton
        fun provideCacheDao(database: CacheDatabase): CacheDao = database.cacheDao()
    }
}
