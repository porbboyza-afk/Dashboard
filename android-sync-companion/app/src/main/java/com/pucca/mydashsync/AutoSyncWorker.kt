package com.pucca.mydashsync

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase
import kotlinx.coroutines.tasks.await
import java.util.concurrent.TimeUnit

class AutoSyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val user = FirebaseAuth.getInstance().currentUser ?: return Result.success()
        val database = FirebaseDatabase.getInstance()
        val statusRef = database.reference
            .child("users")
            .child(user.uid)
            .child("sync_sources")
            .child("health_connect_auto")

        return try {
            val sync = HealthConnectSync(applicationContext)
            if (!sync.hasPermissions()) {
                statusRef.updateChildren(
                    mapOf(
                        "enabled" to true,
                        "last_attempt" to System.currentTimeMillis(),
                        "last_result" to "permissions_missing"
                    )
                ).await()
                return Result.success()
            }

            val result = sync.syncLast30Days(user.uid)
            statusRef.updateChildren(
                mapOf(
                    "enabled" to true,
                    "interval_hours" to AUTO_SYNC_INTERVAL_HOURS,
                    "last_attempt" to System.currentTimeMillis(),
                    "last_result" to "success",
                    "scanned" to result.scanned,
                    "imported" to result.imported,
                    "updated" to result.updated,
                    "skipped" to result.skipped,
                    "wellness_days_updated" to result.wellnessDaysUpdated,
                    "wellness_fields_updated" to result.wellnessFieldsUpdated
                )
            ).await()
            Result.success()
        } catch (error: Exception) {
            statusRef.updateChildren(
                mapOf(
                    "enabled" to true,
                    "last_attempt" to System.currentTimeMillis(),
                    "last_result" to "error",
                    "last_error" to (error.message ?: error.toString())
                )
            ).await()
            Result.retry()
        }
    }

    companion object {
        private const val UNIQUE_WORK_NAME = "mydash-health-connect-auto-sync"
        private const val AUTO_SYNC_INTERVAL_HOURS = 12L

        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .setRequiresBatteryNotLow(true)
                .build()
            val request = PeriodicWorkRequestBuilder<AutoSyncWorker>(
                AUTO_SYNC_INTERVAL_HOURS,
                TimeUnit.HOURS
            )
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request
            )
        }
    }
}
