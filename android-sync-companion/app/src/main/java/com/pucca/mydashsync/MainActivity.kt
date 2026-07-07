package com.pucca.mydashsync

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class MainActivity : ComponentActivity() {
    private lateinit var auth: FirebaseAuth
    private lateinit var googleClient: GoogleSignInClient
    private lateinit var sync: HealthConnectSync

    private lateinit var status: TextView
    private lateinit var detail: TextView
    private lateinit var signInButton: Button
    private lateinit var permissionButton: Button
    private lateinit var syncButton: Button
    private var lastDetailMessage: String? = null

    private val signInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        lifecycleScope.launch {
            if (result.resultCode == RESULT_OK) handleSignInResult(result.data)
            render()
        }
    }

    private val permissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) {
        lifecycleScope.launch { render() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        auth = FirebaseAuth.getInstance()
        sync = HealthConnectSync(this)
        googleClient = GoogleSignIn.getClient(
            this,
            GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(getString(R.string.default_web_client_id))
                .requestEmail()
                .build()
        )
        setContentView(buildUi())
        lifecycleScope.launch { render() }
    }

    private fun buildUi(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 40, 32, 40)
            setBackgroundColor(0xFFF5F7F4.toInt())
        }
        root.addView(TextView(this).apply {
            text = "MyDash Sync"
            textSize = 30f
            setTextColor(0xFF102A2A.toInt())
            gravity = Gravity.START
        })
        root.addView(TextView(this).apply {
            text = "Garmin -> Health Connect -> Firebase -> MyDash Web"
            textSize = 14f
            setTextColor(0xFF607070.toInt())
            setPadding(0, 8, 0, 24)
        })
        status = TextView(this).apply {
            textSize = 18f
            setTextColor(0xFF102A2A.toInt())
            setPadding(0, 0, 0, 16)
        }
        detail = TextView(this).apply {
            textSize = 14f
            setTextColor(0xFF455A5A.toInt())
            setPadding(0, 0, 0, 20)
        }
        root.addView(status)
        root.addView(detail)
        signInButton = actionButton("Sign in with Google") { signInLauncher.launch(googleClient.signInIntent) }
        permissionButton = actionButton("Grant Health Connect permissions") {
            lastDetailMessage = "Opening Health Connect permission screen..."
            detail.text = lastDetailMessage
            permissionLauncher.launch(HealthConnectSync.REQUIRED_PERMISSIONS)
        }
        syncButton = actionButton("Sync last 30 days") {
            lifecycleScope.launch { runSync() }
        }
        root.addView(signInButton)
        root.addView(permissionButton)
        root.addView(syncButton)
        root.addView(actionButton("Open Health Connect settings") { openHealthConnectSettings() })
        return ScrollView(this).apply { addView(root) }
    }

    private fun actionButton(label: String, action: () -> Unit): Button {
        return Button(this).apply {
            text = label
            setAllCaps(false)
            setOnClickListener { action() }
        }
    }

    private suspend fun render() {
        val user = auth.currentUser
        val sdk = HealthConnectClient.getSdkStatus(this)
        val healthStatus = when (sdk) {
            HealthConnectClient.SDK_AVAILABLE -> "Health Connect ready"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "Health Connect needs install/update"
            else -> "Health Connect unavailable"
        }
        val permissionsOk = sdk == HealthConnectClient.SDK_AVAILABLE && sync.hasPermissions()
        status.text = listOf(
            if (user == null) "Not signed in" else "Signed in: ${user.email ?: user.uid}",
            healthStatus,
            if (permissionsOk) "Permissions granted" else "Permissions missing"
        ).joinToString("\n")
        detail.text = lastDetailMessage ?: "This app only syncs activities into your existing MyDash Firebase account. Dashboard and analytics stay in the web app."
        signInButton.isEnabled = user == null
        permissionButton.isEnabled = sdk == HealthConnectClient.SDK_AVAILABLE
        syncButton.isEnabled = user != null && permissionsOk
    }

    private suspend fun handleSignInResult(data: Intent?) {
        val account = GoogleSignIn.getSignedInAccountFromIntent(data).await()
        val idToken = account.idToken ?: throw IllegalStateException("Google ID token missing")
        auth.signInWithCredential(GoogleAuthProvider.getCredential(idToken, null)).await()
    }

    private suspend fun runSync() {
        syncButton.isEnabled = false
        status.text = "Syncing..."
        try {
            val user = auth.currentUser ?: error("Sign in first")
            val result = sync.syncLast30Days(user.uid)
            status.text = "Sync complete"
            lastDetailMessage = "Imported ${result.imported}, updated ${result.updated}, skipped ${result.skipped}, scanned ${result.scanned} sessions.\n${result.message}"
            Log.i("MyDashSync", "Sync complete: scanned=${result.scanned}, imported=${result.imported}, updated=${result.updated}, skipped=${result.skipped}")
            detail.text = lastDetailMessage
        } catch (error: Exception) {
            status.text = "Sync failed"
            lastDetailMessage = error.message ?: error.toString()
            Log.e("MyDashSync", "Sync failed", error)
            detail.text = lastDetailMessage
        } finally {
            render()
        }
    }

    private fun openHealthConnectSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${HealthConnectSync.PROVIDER_PACKAGE}")
        }
        startActivity(intent)
    }
}
