package com.deinefirma.wortdestages

import eu.wortdestages.app.BuildConfig
import expo.modules.splashscreen.SplashScreenManager

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsetsController
import android.view.WindowManager

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  private fun applyDarkSystemBars() {
    val darkColor = Color.parseColor("#171310")

    window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
    window.decorView.setBackgroundColor(darkColor)
    window.statusBarColor = darkColor
    window.navigationBarColor = darkColor

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isStatusBarContrastEnforced = false
      window.isNavigationBarContrastEnforced = false
      window.navigationBarDividerColor = darkColor
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      window.decorView.systemUiVisibility = window.decorView.systemUiVisibility and
        View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv() and
        View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.setDecorFitsSystemWindows(true)
      window.insetsController?.setSystemBarsAppearance(
        0,
        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
          WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
      )
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    SplashScreenManager.registerOnActivity(this)
    super.onCreate(null)
    applyDarkSystemBars()
  }

  override fun onResume() {
    super.onResume()
    applyDarkSystemBars()
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      object : DefaultReactActivityDelegate(
        this,
        mainComponentName,
        fabricEnabled
      ) {}
    )
  }

  /**
   * Align the back button behavior with Android S
   * where moving root activities to background instead of finishing activities.
   */
  override fun invokeDefaultOnBackPressed() {
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
      if (!moveTaskToBack(false)) {
        super.invokeDefaultOnBackPressed()
      }
      return
    }

    super.invokeDefaultOnBackPressed()
  }
}
