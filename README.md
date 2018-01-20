# Domoticz P1 USB #

Homey app to integrate a P1 energy meter connected to a Domoticz server. Special thanks to the creator of the Plugwise Smile P1 app. This app is merely a small variation to that app, so all credits should go to Robin Gruijter.

The app logs and provides flow cards for the following data:
- Actual power usage/production (W, 10s interval)
- Totalized power meter (kWh)
- All individual power meters (kWh)
- Recent gas usage (m3, of the previous hour)
- Gas meter (m3)
- Tariff change (off-peak, true or false)

Ledring screensaver:
- See how much energy you are using or producing just by looking at your Homey!
- Is the wash-dryer ready? Am I now producing power to the grid?

The power is totalized for consumed and produced power, during off-peak and
peak hours. Production to the powergrid is displayed as negative watts.
Only changed values are logged.

To setup go to "Devices" and enter the IP-address, port, username, password and Domoticz device IDs.
The polling interval can be changed in the device settings.

===============================================================================

Version changelog

```
v0.0.1  2018.01.20 Initial release
```
