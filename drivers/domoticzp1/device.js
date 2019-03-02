'use strict';

const Homey = require('homey');

class DomoticzP1Device extends Homey.Device {

	// this method is called when the Device is inited
	async onInit() {
		// this.log('device init: ', this.getName(), 'id:', this.getData().id);
		try {
			// init some stuff
			this._driver = this.getDriver();
			this._ledring = Homey.app.ledring;
			this.handleNewReadings = this._driver.handleNewReadings.bind(this);
			this.watchDogCounter = 10;
			const settings = this.getSettings();
			this.meters = {};
			this.initMeters();
			// create domoticzP1 session
			this.domoticzP1 = new this._driver.P1(
				settings.domoticzIp,
				settings.port,
				settings.username,
				settings.password,
				settings.electricityId,
				settings.gasId
			);
			// register trigger flow cards of custom capabilities
			this.tariffChangedTrigger = new Homey.FlowCardTriggerDevice('tariff_changed')
				.register();
			this.powerChangedTrigger = new Homey.FlowCardTriggerDevice('power_changed')
				.register();
			// register condition flow cards
			const offPeakCondition = new Homey.FlowCardCondition('offPeak');
			offPeakCondition.register()
				.registerRunListener(() => Promise.resolve(this.meters.lastOffpeak));
			// start polling device for info
			this.intervalIdDevicePoll = setInterval(() => {
				try {
					if (this.watchDogCounter <= 0) {
						// restart the app here
						this.log('watchdog triggered, restarting app now');
						this.restartDevice();
					}
					// get new readings and update the devicestate
					this.doPoll();
				} catch (error) {
					this.watchDogCounter -= 1;
					this.log('intervalIdDevicePoll error', error);
				}
			}, 1000 * settings.pollingInterval);
		} catch (error) {
			this.error(error);
		}
	}

	// this method is called when the Device is added
	onAdded() {
		this.log(`DomoticzP1 added as device: ${this.getName()}`);
	}

	// this method is called when the Device is deleted
	onDeleted() {
		// stop polling
		clearInterval(this.intervalIdDevicePoll);
		this.log(`DomoticzP1 deleted as device: ${this.getName()}`);
	}

	onRenamed(name) {
		this.log(`DomoticzP1 renamed to: ${name}`);
	}

	// this method is called when the user has changed the device's settings in Homey.
	onSettings(oldSettingsObj, newSettingsObj, changedKeysArr, callback) {
		this.log('settings change requested by user');
		// this.log(newSettingsObj);
		this.domoticzP1.getMeter(
			newSettingsObj.domoticzIp,
			newSettingsObj.port,
			newSettingsObj.username,
			newSettingsObj.password,
			newSettingsObj.electricityId,
			newSettingsObj.gasId
		).then(() => {		// new settings are correct
			this.log(`${this.getName()} device settings changed`);
			// do callback to confirm settings change
			callback(null, true);
			this.restartDevice();
		})
			.catch((error) => {		// new settings are incorrect
				this.error(error.message);
				this.domoticzP1.getMeter(
					oldSettingsObj.domoticzIp,
					oldSettingsObj.port,
					oldSettingsObj.username,
					oldSettingsObj.password,
					oldSettingsObj.electricityId,
					oldSettingsObj.gasId
				);
				return callback(error);
			});
	}

	async doPoll() {
		// this.log('polling for new readings');
		try {
			let readings = {};
			let gasReadings = {};
			readings = await this.domoticzP1.getMeter();
			gasReadings = await this.domoticzP1.getGasMeter();
			this.setAvailable();
			this.handleNewReadings(readings);
			this.handleNewReadings(gasReadings);
		} catch (error) {
			this.watchDogCounter -= 1;
			this.log(`Poll error: ${error}`);
			this.setUnavailable(error)
				.catch(this.error);
		}
	}

	restartDevice() {
		// stop polling the device, then start init after short delay
		clearInterval(this.intervalIdDevicePoll);
		setTimeout(() => {
			this.onInit();
		}, 10000);
	}

	initMeters() {
		this.meters = {
			lastMeasureGas: 0,										// 'measureGas' (m3)
			lastMeasureGasToday: 0,										// 'lastMeasureGasToday' (m3)
			lastMeterGas: null, 									// 'meterGas' (m3)
			lastMeterGasTm: 0,										// timestamp of gas meter reading, e.g. 1514394325
			lastMeasurePower: 0,									// 'measurePower' (W)
			lastMeasurePowerAvg: 0,								// '2 minute average measurePower' (kWh)
			lastMeterPower: null,									// 'meterPower' (kWh)
			lastMeterPowerPeak: null,							// 'meterPower_peak' (kWh)
			lastMeterPowerOffpeak: null,					// 'meterPower_offpeak' (kWh)
			lastMeterPowerPeakProduced: null,			// 'meterPower_peak_produced' (kWh)
			lastMeterPowerOffpeakProduced: null,	// 'meterPower_offpeak_produced' (kWh)
			lastMeterPowerTm: null, 							// timestamp epoch, e.g. 1514394325
			lastMeterPowerInterval: null,					// 'meterPower' at last interval (kWh)
			lastMeterPowerIntervalTm: null, 			// timestamp epoch, e.g. 1514394325
			lastOffpeak: null,										// 'meterPower_offpeak' (true/false)
		};
	}

	precisionRound(number, precision = 0) {
		const factor = Math.pow(10, precision);
		return Math.round(number * factor) / factor;
	}

	updateDeviceState() {
		// this.log(`updating states for: ${this.getName()}`);
		try {
			this.setCapabilityValue('measure_gas', this.precisionRound(this.meters.lastMeasureGas, 1));
			this.setCapabilityValue('measure_power', this.meters.lastMeasurePower);
			this.setCapabilityValue('meter_offPeak', this.meters.lastOffpeak);
			this.setCapabilityValue('meter_gas', this.precisionRound(this.meters.lastMeterGas));
			this.setCapabilityValue('meter_power', this.precisionRound(this.meters.lastMeterPower));
			this.setCapabilityValue('meter_power.peak', this.precisionRound(this.meters.lastMeterPowerPeak));
			this.setCapabilityValue('meter_power.offPeak', this.precisionRound(this.meters.lastMeterPowerOffpeak));
			this.setCapabilityValue('meter_power.producedPeak', this.precisionRound(this.meters.lastMeterPowerPeakProduced));
			this.setCapabilityValue('meter_power.producedOffPeak', this.precisionRound(this.meters.lastMeterPowerOffpeakProduced));
			// reset watchdog
			this.watchDogCounter = 10;
		} catch (error) {
			this.error(error);
		}
	}

}

module.exports = DomoticzP1Device;
