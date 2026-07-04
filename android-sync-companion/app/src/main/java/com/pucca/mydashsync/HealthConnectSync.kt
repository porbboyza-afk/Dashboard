package com.pucca.mydashsync

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.google.firebase.database.FirebaseDatabase
import kotlinx.coroutines.tasks.await
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt

class HealthConnectSync(private val context: Context) {
    private val client by lazy { HealthConnectClient.getOrCreate(context) }
    private val database by lazy { FirebaseDatabase.getInstance() }
    private val zoneId: ZoneId = ZoneId.systemDefault()

    suspend fun hasPermissions(): Boolean {
        val granted = client.permissionController.getGrantedPermissions()
        return granted.containsAll(REQUIRED_PERMISSIONS)
    }

    suspend fun syncLast30Days(uid: String): SyncResult {
        if (!hasPermissions()) error("Health Connect permissions are missing")

        val now = Instant.now()
        val start = now.minus(Duration.ofDays(30))
        val sessions = client.readRecords(
            ReadRecordsRequest(
                recordType = ExerciseSessionRecord::class,
                timeRangeFilter = TimeRangeFilter.between(start, now)
            )
        ).records

        var imported = 0
        var skipped = 0
        val workoutRef = database.reference.child("users").child(uid).child("workouts")

        for (session in sessions) {
            val workout = mapSession(session)
            if (workout.dist <= 0.0 || workout.time <= 0.0) {
                skipped++
                continue
            }
            val id = deterministicId(workout)
            val existing = workoutRef.child(id).get().await()
            if (existing.exists()) {
                skipped++
                continue
            }
            workoutRef.child(id).setValue(workout.toMap()).await()
            imported++
        }

        val syncStatus = mapOf(
            "last_sync" to System.currentTimeMillis(),
            "source" to "health_connect",
            "scanned" to sessions.size,
            "imported" to imported,
            "skipped" to skipped
        )
        database.reference.child("users").child(uid)
            .child("sync_sources").child("health_connect")
            .setValue(syncStatus).await()

        return SyncResult(
            scanned = sessions.size,
            imported = imported,
            skipped = skipped,
            message = if (sessions.isEmpty()) {
                "No Health Connect exercise sessions found in the last 30 days. Confirm Garmin Connect is writing to Health Connect."
            } else {
                "Open MyDash Web and refresh to see imported activities."
            }
        )
    }

    private suspend fun mapSession(session: ExerciseSessionRecord): MyDashWorkout {
        val minutes = Duration.between(session.startTime, session.endTime).toMillis() / 60000.0
        val distanceKm = readDistanceKm(session.startTime, session.endTime)
        val avgHeartRate = readAverageHeartRate(session.startTime, session.endTime)
        val calories = readCalories(session.startTime, session.endTime)
        val date = LocalDateTime.ofInstant(session.startTime, zoneId).toLocalDate()
            .format(DateTimeFormatter.ISO_LOCAL_DATE)
        val avgPace = if (distanceKm > 0) minutes / distanceKm else 0.0
        val type = mapExerciseType(session.exerciseType)
        val nowMs = System.currentTimeMillis()

        return MyDashWorkout(
            date = date,
            type = type,
            dist = round(distanceKm, 2),
            time = round(minutes, 1),
            hr = avgHeartRate,
            cad = 0,
            avgPace = round(avgPace, 3),
            name = session.title ?: "Health Connect ${type.replaceFirstChar { it.uppercase() }}",
            note = session.notes ?: "",
            source = "health_connect",
            sourceApp = session.metadata.dataOrigin.packageName,
            healthConnectId = session.metadata.id,
            syncSource = "garmin_via_health_connect",
            calories = calories,
            importedAt = nowMs,
            createdAt = nowMs,
            updatedAt = nowMs
        )
    }

    private suspend fun readDistanceKm(start: Instant, end: Instant): Double {
        val records = client.readRecords(
            ReadRecordsRequest(
                recordType = DistanceRecord::class,
                timeRangeFilter = TimeRangeFilter.between(start, end)
            )
        ).records
        return records.sumOf { it.distance.inKilometers }
    }

    private suspend fun readAverageHeartRate(start: Instant, end: Instant): Int {
        val records = client.readRecords(
            ReadRecordsRequest(
                recordType = HeartRateRecord::class,
                timeRangeFilter = TimeRangeFilter.between(start, end)
            )
        ).records
        val samples = records.flatMap { it.samples }.map { it.beatsPerMinute }
        return if (samples.isEmpty()) 0 else samples.average().roundToInt()
    }

    private suspend fun readCalories(start: Instant, end: Instant): Double {
        val records = client.readRecords(
            ReadRecordsRequest(
                recordType = TotalCaloriesBurnedRecord::class,
                timeRangeFilter = TimeRangeFilter.between(start, end)
            )
        ).records
        return round(records.sumOf { it.energy.inKilocalories }, 1)
    }

    private fun mapExerciseType(type: Int): String {
        return when (type) {
            ExerciseSessionRecord.EXERCISE_TYPE_BIKING,
            ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "bike"
            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER,
            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL -> "swim"
            ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "walk"
            else -> "run"
        }
    }

    private fun deterministicId(workout: MyDashWorkout): String {
        val source = listOf(
            workout.date,
            workout.type,
            (workout.dist * 20).roundToInt(),
            workout.time.roundToInt(),
            workout.healthConnectId
        ).joinToString("|")
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(source.toByteArray())
            .joinToString("") { "%02x".format(it) }
            .take(24)
        return "health-connect-$digest"
    }

    private fun round(value: Double, decimals: Int): Double {
        var factor = 1.0
        repeat(decimals) { factor *= 10.0 }
        return kotlin.math.round(value * factor) / factor
    }

    companion object {
        const val PROVIDER_PACKAGE = "com.google.android.apps.healthdata"
        val REQUIRED_PERMISSIONS = setOf(
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
            HealthPermission.getReadPermission(DistanceRecord::class),
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class)
        )
    }
}

data class SyncResult(
    val scanned: Int,
    val imported: Int,
    val skipped: Int,
    val message: String
)

data class MyDashWorkout(
    val date: String,
    val type: String,
    val dist: Double,
    val time: Double,
    val hr: Int,
    val cad: Int,
    val avgPace: Double,
    val name: String,
    val note: String,
    val source: String,
    val sourceApp: String,
    val healthConnectId: String,
    val syncSource: String,
    val calories: Double,
    val importedAt: Long,
    val createdAt: Long,
    val updatedAt: Long
) {
    fun toMap(): Map<String, Any> {
        return mapOf(
            "date" to date,
            "type" to type,
            "dist" to dist,
            "time" to time,
            "hr" to hr,
            "cad" to cad,
            "avgPace" to avgPace,
            "name" to name,
            "note" to note,
            "source" to source,
            "sourceApp" to sourceApp,
            "healthConnectId" to healthConnectId,
            "syncSource" to syncSource,
            "calories" to calories,
            "importedAt" to importedAt,
            "createdAt" to createdAt,
            "updatedAt" to updatedAt
        )
    }
}
