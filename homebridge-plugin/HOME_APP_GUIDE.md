# Home App Display Guide

This guide explains what you'll see in the Apple Home app and what each sensor actually represents.

## 🎮 Main Control Device

**"HVN Home PC"** - Single device with 3 switches:
- ⚡ **Wake** - Tap to send Wake-on-LAN magic packet
- 💤 **Sleep** - Tap to put PC to sleep via SSH
- 🔴 **Shutdown** - Tap to shutdown PC via SSH

## 📊 Monitoring Sensors

Due to HomeKit limitations, PC metrics are mapped to standard sensor types. Here's what each sensor shows:

### 🌡️ HVN Home PC CPU Percent
**Type**: Temperature Sensor
**What it shows**: CPU usage percentage
**How to read**: 45°C = 45% CPU usage
**Icon**: Thermometer

### 💧 HVN Home PC RAM Percent
**Type**: Humidity Sensor
**What it shows**: RAM usage percentage
**How to read**: 67% = 67% RAM used
**Icon**: Water droplet

### 🌡️ HVN Home PC GPU Percent
**Type**: Temperature Sensor
**What it shows**: GPU usage percentage
**How to read**: 80°C = 80% GPU usage
**Icon**: Thermometer

### 💡 HVN Home PC Power Watts
**Type**: Light Sensor
**What it shows**: Power consumption in Watts
**How to read**: 350 lux = 350 Watts
**Icon**: Light bulb

### 📱 HVN Home PC Online Status
**Type**: Contact Sensor
**What it shows**: Whether PC is online or offline
**How to read**:
- "Detected" = PC is online
- "Not Detected" = PC is offline
**Icon**: Sensor

## 🗣️ Siri Commands

### Control Commands
```
"Hey Siri, turn on Wake"
"Hey Siri, turn on Sleep"
"Hey Siri, turn on Shutdown"
```

### Status Commands
```
"Hey Siri, what's the CPU temperature?"
→ Response: "The CPU Percent is 45 degrees" (= 45% CPU)

"Hey Siri, what's the humidity in HVN Home PC?"
→ Response: "67 percent" (= 67% RAM)

"Hey Siri, what's the GPU temperature?"
→ Response: "80 degrees" (= 80% GPU)

"Hey Siri, what's the light level in HVN Home PC?"
→ Response: "350 lux" (= 350 Watts)

"Hey Siri, is HVN Home PC detected?"
→ Response: "Yes, detected" (PC is online)
```

## 📱 Home App Tips

### Renaming in Home App
1. Long-press any accessory
2. Tap "Settings" (gear icon)
3. Tap "Name"
4. Change to whatever you want (e.g., "My PC CPU")

### Creating Widgets
1. Add Home app widget to iPhone home screen
2. Tap widget to configure
3. Select your favorite accessories (Wake, CPU %, etc.)
4. Quick glance at PC status!

### Creating Automations
**Example 1: Auto-sleep at night**
```
When: Time is 11:00 PM
Do: Turn on "Sleep"
Result: PC automatically goes to sleep
```

**Example 2: Wake notification**
```
When: "Online Status" changes to "Detected"
Do: Send notification "Your PC is now online"
```

**Example 3: High CPU alert**
```
When: "CPU Percent" rises above 90°C
Do: Send notification "High CPU usage: 90%+"
```

## 🔧 Troubleshooting

### Accessories not showing
1. Remove Homebridge bridge from Home app
2. Re-add by scanning QR code in Homebridge UI
3. All accessories should appear fresh

### Wrong values showing
- The metrics are real, just displayed using different units
- CPU 45°C = 45% CPU usage (not actual temperature)
- RAM 67% humidity = 67% RAM used
- GPU 80°C = 80% GPU usage
- Power 350 lux = 350 Watts

### Metrics not updating
- Check PC Remote Wake web app is running
- Verify SSH credentials in device settings
- Check Homebridge logs: `sudo tail -f /var/lib/homebridge/homebridge.log`

## 📊 Want Real Charts?

For proper PC monitoring with real units, use:
- **Web UI**: http://100.66.154.21:3000 (shows actual charts with proper labels)
- **Homebridge UI**: http://100.66.154.21:8581 (can create custom tiles)
- **Third-party apps**: Home+, Controller (allow custom sensor names)

## 🎯 Summary

Yes, it's a bit "hacky" using temperature sensors for CPU and humidity for RAM, but:
- ✅ The data is **real** (collected via SSH from your PC)
- ✅ It **works** in the native Home app
- ✅ You can **control** your PC with Siri
- ✅ It's better than **no PC monitoring** in HomeKit!

Enjoy controlling your PC with Apple Home! 🎉
