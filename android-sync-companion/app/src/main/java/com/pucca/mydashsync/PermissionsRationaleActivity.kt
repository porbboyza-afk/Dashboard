package com.pucca.mydashsync

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class PermissionsRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 40, 32, 40)
            setBackgroundColor(0xFFF5F7F4.toInt())
        }
        root.addView(TextView(this).apply {
            text = "MyDash Sync privacy"
            textSize = 26f
            setTextColor(0xFF102A2A.toInt())
        })
        root.addView(TextView(this).apply {
            text = "MyDash Sync reads Health Connect exercise, distance, heart rate, and calories only to import your workouts into your own MyDash Firebase account. It does not sell data, show ads, or share data with third parties."
            textSize = 16f
            setTextColor(0xFF455A5A.toInt())
            setPadding(0, 20, 0, 20)
            gravity = Gravity.START
        })
        root.addView(Button(this).apply {
            text = "Close"
            setAllCaps(false)
            setOnClickListener { finish() }
        })
        setContentView(ScrollView(this).apply { addView(root) })
    }
}
