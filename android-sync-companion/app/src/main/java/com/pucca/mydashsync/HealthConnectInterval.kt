package com.pucca.mydashsync

import java.time.Duration
import java.time.Instant

// Preserve source intervals. Missing lengths are not zero; time is elapsed, not moving.
fun healthConnectInterval(start: Instant, end: Instant, meters: Double?): Map<String, Any> {
    val row = mutableMapOf<String, Any>(
        "startTimeUtc" to start.toString(),
        "endTimeUtc" to end.toString(),
        "durationSeconds" to Duration.between(start, end).toMillis() / 1000.0
    )
    if (meters != null && meters.isFinite() && meters >= 0) row["distanceMeters"] = meters
    return row
}
