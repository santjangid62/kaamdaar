package com.kaamdaar.kaamdaar_provider

import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Repeating audible foreground alert while a provider job offer is active.
 * Background alerts are shown by FCM + flutter_local_notifications.
 */
class MainActivity : FlutterActivity() {
    private var tone: ToneGenerator? = null
    private val handler = Handler(Looper.getMainLooper())
    private var ringing = false
    private val repeatTone = object : Runnable {
        override fun run() {
            if (!ringing) return
            tone?.startTone(ToneGenerator.TONE_PROP_BEEP2, 650)
            handler.postDelayed(this, 1100)
        }
    }

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        // Let a full-screen incoming-job notification appear over the keyguard.
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        createJobAlertChannel()
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "kaamdaar/alerts")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "startAlarm" -> {
                        startAlarm()
                        result.success(null)
                    }
                    "stopAlarm" -> {
                        stopAlarm()
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun createJobAlertChannel() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "kaamdaar_job_alerts_v4",
                "Kaamdaar new job requests",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Audible alerts for incoming provider service requests"
                enableVibration(true)
                setSound(
                    android.provider.Settings.System.DEFAULT_NOTIFICATION_URI,
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun startAlarm() {
        if (ringing) return
        ringing = true
        tone = ToneGenerator(android.media.AudioManager.STREAM_ALARM, 100)
        handler.removeCallbacks(repeatTone)
        repeatTone.run()
    }

    private fun stopAlarm() {
        ringing = false
        handler.removeCallbacks(repeatTone)
        tone?.release()
        tone = null
    }

    override fun onDestroy() {
        stopAlarm()
        super.onDestroy()
    }
}
