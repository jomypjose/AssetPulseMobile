package com.assetpulse.monitor.di

import com.assetpulse.monitor.BuildConfig
import com.assetpulse.monitor.data.remote.AssetPulseApi
import com.assetpulse.monitor.data.remote.AuthInterceptor
import com.assetpulse.monitor.data.remote.HostSelectionInterceptor
import com.assetpulse.monitor.data.remote.RefreshApi
import com.assetpulse.monitor.data.remote.TokenAuthenticator
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit
import javax.inject.Qualifier
import javax.inject.Singleton

/** Marks the bare client/Retrofit used only for `/auth/refresh`. */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class RefreshClient

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    /**
     * Placeholder base URL. Every request is rewritten onto the configured
     * server by [HostSelectionInterceptor]; Retrofit just needs something
     * syntactically valid here.
     */
    private const val PLACEHOLDER_BASE_URL = "http://server.invalid/"

    private const val TIMEOUT_SECONDS = 15L // matches the RN client's axios timeout

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
        isLenient = true
    }

    @Provides
    @Singleton
    fun provideLoggingInterceptor(): HttpLoggingInterceptor =
        HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BASIC
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        hostSelection: HostSelectionInterceptor,
        auth: AuthInterceptor,
        authenticator: TokenAuthenticator,
        logging: HttpLoggingInterceptor,
    ): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(hostSelection)
        .addInterceptor(auth)
        .addInterceptor(logging)
        .authenticator(authenticator)
        .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .build()

    /** No auth interceptor, no authenticator — refresh must not recurse. */
    @Provides
    @Singleton
    @RefreshClient
    fun provideRefreshOkHttpClient(
        hostSelection: HostSelectionInterceptor,
        logging: HttpLoggingInterceptor,
    ): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(hostSelection)
        .addInterceptor { chain ->
            chain.proceed(
                chain.request().newBuilder()
                    .header("X-Token-Transport", "body")
                    .build()
            )
        }
        .addInterceptor(logging)
        .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .build()

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient, json: Json): Retrofit = Retrofit.Builder()
        .baseUrl(PLACEHOLDER_BASE_URL)
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    @Provides
    @Singleton
    @RefreshClient
    fun provideRefreshRetrofit(
        @RefreshClient client: OkHttpClient,
        json: Json,
    ): Retrofit = Retrofit.Builder()
        .baseUrl(PLACEHOLDER_BASE_URL)
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    @Provides
    @Singleton
    fun provideAssetPulseApi(retrofit: Retrofit): AssetPulseApi =
        retrofit.create(AssetPulseApi::class.java)

    @Provides
    @Singleton
    fun provideRefreshApi(@RefreshClient retrofit: Retrofit): RefreshApi =
        retrofit.create(RefreshApi::class.java)
}
