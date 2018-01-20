'use strict';

const Homey = require('homey');
const Ledring = require('./ledring.js');
const Logger = require('./captureLogs.js');

class DomoticzP1App extends Homey.App {

	onInit() {
		this.log('Domoticz P1 App is running!');
		this.ledring = new Ledring();
		this.logger = new Logger();	// [logName] [, logLength]

		process.on('unhandledRejection', (error) => {
			this.error('unhandledRejection! ', error);
		});
		Homey.on('unload', () => {
			this.log('app unload called');
			// save logs to persistant storage
			this.logger.saveLogs();
		});
	}

	// ============================================================
	// logfile stuff for frontend API here
	deleteLogs() {
		return this.logger.deleteLogs();
	}
	getLogs() {
		return this.logger.logArray;
	}

	// ===================================================================
	// testing stuff here
	async testDomoticzP1() {
		try {
			// get the meter values
			const meter = await this.domoticzP1.getMeter();
			console.log(meter);
		}	catch (error) {
			console.log(error);
		}
	}

}

module.exports = DomoticzP1App;
