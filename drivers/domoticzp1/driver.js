'use strict';

const Homey = require('homey');
const DomoticzP1 = require('../../domoticzP1.js');

class DomoticzP1Driver extends Homey.Driver {

	onInit() {
		this.log('Entering DomoticzP1 driver');
		this.P1 = DomoticzP1;
	}

	onPair(socket) {
		socket.on('validate', async (data, callback) => {
			try {
				this.log('save button pressed in frontend');
				const p1 = new this.P1(data.domoticzIp, data.port, data.username, data.password, data.electricityId, data.gasId);
				// try to get status
				await p1.getMeter()
					.then(() => {
						callback(null, ' Domoticz P1 device found!'); // report success to frontend
					})
					.catch((error) => {
						callback(error);
					});
			} catch (error) {
				this.error('Pair error', error);
				if (error.code === 'EHOSTUNREACH') {
					callback(Error('Incorrect IP address'));
				}
				callback(error);
			}
		});
	}

	handleNewReadings(readings) {	// call with device as this
		// gas readings from device
		let meterGas = this.meters.lastMeterGas;
		let measureGas = this.meters.lastMeasureGas;
		let meterGasTm = this.meters.lastMeterGasTm;
		let measureGasToday = this.meters.lastMeasureGasToday;
		if (readings.g !== undefined) {
			meterGas = readings.g.gas; // gas_cumulative_meter
			meterGasTm = readings.g.gasTm / 1000; // gas_meter_timestamp
			measureGasToday = readings.g.gasToday;

			if (this.meters.lastMeterGasTm !== meterGasTm) {
				if (this.meters.lastMeterGas !== null) {	// first reading after init
					measureGas = Math.round(1000 * (measureGasToday - this.meters.lastMeasureGasToday)) / 1000; // gas_interval_meter
				}
				if(measureGas <= 0) {
					measureGas = undefined;
				}
				this.meters.lastMeterGasTm = meterGasTm;
			}
			// store the new readings in memory
			if(measureGas) {
				this.meters.lastMeasureGas = measureGas;
			}
			this.meters.lastMeasureGasToday = measureGasToday;
			this.meters.lastMeterGas = meterGas;
			this.meters.lastMeterGasTm = meterGasTm || this.meters.lastMeterGasTm;
		}

		if (readings.e !== undefined) {
			// electricity readings from device
			const meterPowerOffpeakProduced = readings.e.powerOffpeakProduced;
			const meterPowerPeakProduced = readings.e.powerPeakProduced;
			const meterPowerOffpeak = readings.e.powerOffpeak;
			const meterPowerPeak = readings.e.powerPeak;
			let measurePower = (readings.e.measurePower - readings.e.measurePowerProduced);
			let measurePowerAvg = this.meters.lastMeasurePowerAvg;
			const meterPowerTm = readings.e.powerTm / 1000;
			// constructed electricity readings
			const meterPower = (meterPowerOffpeak + meterPowerPeak) - (meterPowerOffpeakProduced + meterPowerPeakProduced);
			let offPeak = this.meters.lastOffpeak;
			if ((meterPower - this.meters.lastMeterPower) !== 0) {
				offPeak = ((meterPowerOffpeakProduced - this.meters.lastMeterPowerOffpeakProduced) > 0
					|| (meterPowerOffpeak - this.meters.lastMeterPowerOffpeak) > 0);
			}
			// measurePowerAvg 2 minutes average based on cumulative meters
			if (this.meters.lastMeterPowerIntervalTm === null) {	// first reading after init
				this.meters.lastMeterPowerInterval = meterPower;
				this.meters.lastMeterPowerIntervalTm = meterPowerTm;
			}
			if ((meterPowerTm - this.meters.lastMeterPowerIntervalTm) >= 120) {
				measurePowerAvg = Math.round((3600000 / 120) * (meterPower - this.meters.lastMeterPowerInterval));
				this.meters.lastMeterPowerInterval = meterPower;
				this.meters.lastMeterPowerIntervalTm = meterPowerTm;
			}
			// correct measurePower with average measurePower_produced in case point_meter_produced is always zero
			if (measurePower === 0 && measurePowerAvg < 0) {
				measurePower = measurePowerAvg;
			}
			const measurePowerDelta = (measurePower - this.meters.lastMeasurePower);
			// trigger the custom trigger flowcards
			if (offPeak !== this.meters.lastOffpeak) {
				const tokens = { tariff: offPeak };
				this.tariffChangedTrigger
					.trigger(this, tokens)
					.catch(this.error);
				// .then(this.error('Tariff change flow card triggered'));
			}
			if (measurePower !== this.meters.lastMeasurePower) {
				const tokens = {
					power: measurePower,
					power_delta: measurePowerDelta,
				};
				this.powerChangedTrigger
					.trigger(this, tokens)
					.catch(this.error);
				// .then(this.error('Power change flow card triggered'));
				// update the ledring screensavers
				this._ledring.change(this.getSettings(), this.meters.lastMeasurePower);
			}
			// store the new readings in memory
			this.meters.lastMeasurePower = measurePower;
			this.meters.lastMeasurePowerAvg = measurePowerAvg;
			this.meters.lastMeterPower = meterPower;
			this.meters.lastMeterPowerPeak = meterPowerPeak;
			this.meters.lastMeterPowerOffpeak = meterPowerOffpeak;
			this.meters.lastMeterPowerPeakProduced = meterPowerPeakProduced;
			this.meters.lastMeterPowerOffpeakProduced = meterPowerOffpeakProduced;
			this.meters.lastMeterPowerTm = meterPowerTm;
			this.meters.lastOffpeak = offPeak;
		}
		// update the device state
		// this.log(this.meters);
		this.updateDeviceState();
	}

}

module.exports = DomoticzP1Driver;
