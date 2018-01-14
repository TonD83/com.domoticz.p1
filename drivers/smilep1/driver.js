'use strict';

const Homey = require('homey');
const SmileP1 = require('../../smileP1.js');

class SmileP1Driver extends Homey.Driver {

	onInit() {
		this.log('entering SmileP1 driver');
		this.Smile = SmileP1;
	}

	onPair(socket) {
		socket.on('validate', async (data, callback) => {
			try {
				this.log('save button pressed in frontend');
				const smile = new this.Smile(data.smileId, data.smileIp);
				this.log(smile);
				// try to get status
				await smile.getMeter()
					.then(() => {
						callback(null, ' Smile device found!'); // report success to frontend
					})
					.catch((error) => {
						callback(error);
					});
			}	catch (error) {
				this.error('Pair error', error);
				if (error.code === 'EHOSTUNREACH') {
					callback(Error('Incorrect IP address'));
				}
				callback(error);
			}
		});
	}

	handleNewReadings(readings) {	// call with device as this
		// this.log(`handling new readings for ${this.getName()}`);
		// gas readings from device
		let meterGas = this.meters.lastMeterGas;
		let measureGas = this.meters.lastMeasureGas;
		let meterGasTm = this.meters.lastMeterGasTm;
		if (readings.g !== undefined) {
			meterGas = readings.g.gas; // gas_cumulative_meter
			meterGasTm = readings.g.gasTm / 1000; // gas_meter_timestamp
			// constructed gas readings
			if (this.meters.lastMeterGasTm !== meterGasTm) {
				if (this.meters.lastMeterGas !== null) {	// first reading after init
					const hoursPassed = (meterGasTm - this.meters.lastMeterGasTm) / 3600;	// hrs
					// if (hoursPassed > 1.5) { // too long ago; assume 1 hour interval
					// 	hoursPassed = 1;
					// }
					measureGas = Math.round(1000 * ((meterGas - this.meters.lastMeterGas) / hoursPassed)) / 1000; // gas_interval_meter
				}
				this.meters.lastMeterGasTm = meterGasTm;
			}
		}

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
			// .then(this.log('Tariff change flow card triggered'));
		}
		if (measurePower !== this.meters.lastMeasurePower) {
			const tokens = {
				power: measurePower,
				power_delta: measurePowerDelta,
			};
			this.powerChangedTrigger
				.trigger(this, tokens)
				.catch(this.error);
			// .then(this.log('Power change flow card triggered'));
			// update the ledring screensavers
			this._ledring.change(this.getSettings(), this.meters.lastMeasurePower);
		}
		// store the new readings in memory
		this.meters.lastMeasureGas = measureGas;
		this.meters.lastMeterGas = meterGas;
		this.meters.lastMeterGasTm = meterGasTm || this.meters.lastMeterGasTm;
		this.meters.lastMeasurePower = measurePower;
		this.meters.lastMeasurePowerAvg = measurePowerAvg;
		this.meters.lastMeterPower = meterPower;
		this.meters.lastMeterPowerPeak = meterPowerPeak;
		this.meters.lastMeterPowerOffpeak = meterPowerOffpeak;
		this.meters.lastMeterPowerPeakProduced = meterPowerPeakProduced;
		this.meters.lastMeterPowerOffpeakProduced = meterPowerOffpeakProduced;
		this.meters.lastMeterPowerTm = meterPowerTm;
		this.meters.lastOffpeak = offPeak;
		// update the device state
		// this.log(this.meters);
		this.updateDeviceState();
	}

}

module.exports = SmileP1Driver;
