package com.assetpulse.monitor.data.local

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Upsert

/**
 * One row per cached payload, keyed by a logical name ("devices", "alerts").
 *
 * This mirrors `src/services/OfflineCache.js`, which stored
 * `{ ts, value }` under a prefixed AsyncStorage key. Keeping the same
 * whole-payload shape (rather than modelling each list as its own table) means
 * the screens keep the RN behaviour exactly: on a failed fetch, show the last
 * snapshot plus how stale it is.
 */
@Entity(tableName = "cache_entries")
data class CacheEntry(
    @PrimaryKey val key: String,
    val json: String,
    val cachedAt: Long,
)

@Dao
interface CacheDao {

    @Query("SELECT * FROM cache_entries WHERE `key` = :key LIMIT 1")
    suspend fun get(key: String): CacheEntry?

    @Upsert
    suspend fun put(entry: CacheEntry)

    @Query("DELETE FROM cache_entries WHERE `key` = :key")
    suspend fun delete(key: String)

    @Query("DELETE FROM cache_entries")
    suspend fun clear()
}

@Database(entities = [CacheEntry::class], version = 1, exportSchema = false)
abstract class CacheDatabase : RoomDatabase() {
    abstract fun cacheDao(): CacheDao
}
