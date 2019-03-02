'use strict';

const http = require('http');

const meterPath = '/json.htm?type=devices&rid=';
const defaultPort = 8080;

class DomoticzP1 {
	// Represents a session to a Domoticz P1 device.
	constructor(host, port, username, password, electricityId, gasId) {
		this.host = host;
		this.port = port || defaultPort;
		this.username = username;
		this.password = password;
		this.electricityId = electricityId;
		this.gasId = gasId;
	}

	precisionRound(number, precision = 2) {
		const factor = Math.pow(10, precision);
		return Math.round(number * factor) / factor;
	}

	parseMonth(month) {
		const _month = Number.parseInt(month);
		switch(_month) {
			case 1:
				return 'Jan';
				break;
			case 2:
				return 'Feb';
				break;
			case 3:
				return 'Mar';
				break;
			case 4:
				return 'Apr';
				break;
			case 5:
				return 'May';
				break;
			case 6:
				return 'Jun';
				break;
			case 7:
				return 'Jul';
				break;
			case 8:
				return 'Aug';
				break;
			case 9:
				return 'Sep';
				break;
			case 10:
				return 'Oct';
				break;
			case 11:
				return 'Nov';
				break;
			case 12:
				return 'Dec';
				break;
			default:
				return 'Jan';
				break;
		}
	}

	formatDate(dateString) {
		try {
			const dateParts = dateString.split(' ');
			const date = dateParts[0];
			const time = dateParts[1];
	
			const dayMonthYear = date.split('-');
			let month = dayMonthYear[1];
			const day = dayMonthYear[2];
			let year = dayMonthYear[0];
			month = this.parseMonth(month);
	
			const dateFormatted = `${day} ${month} ${year} ${time}`;
			return Date.parse(dateFormatted);
		} catch (error) {
			throw new Error('Error parsing date');
		}
	}

	getMeter(host, port, username, password, electricityId, gasId) {
		this.host = host || this.host;
		this.port = port || this.port;
		this.username = username || this.username;
		this.password = password || this.password;
		this.electricityId = electricityId || this.electricityId;
		this.gasId = gasId || this.gasId;
		return new Promise((resolve, reject) => {
			this._makeRequest(meterPath + this.electricityId)
				.then((result) => {
					const readings = {};
					try {
						const responseJson = JSON.parse(result.body);
						const data = responseJson.result[0].Data;
						const updateTime = responseJson.result[0].LastUpdate;
						const measurements = data.split(';');

						const measurePower = Number(measurements[4]);
						const measurePowerProduced = Number(measurements[5]);
						const powerPeak = this.precisionRound(Number(measurements[1]) / 1000);
						const powerOffpeak = this.precisionRound(Number(measurements[0]) / 1000);
						const powerPeakProduced = this.precisionRound(Number(measurements[2]) / 1000);
						const powerOffpeakProduced = this.precisionRound(Number(measurements[3]) / 1000);
						const powerTm = this.formatDate(updateTime);

						readings.e = {
							measurePower,
							measurePowerProduced,
							powerPeak,
							powerOffpeak,
							powerPeakProduced,
							powerOffpeakProduced,
							powerTm,
						};
					} catch (error) {
						return reject(Error('Error parsing power information'));
					}
					return resolve(readings);
				})
				.catch((error) => {
					reject(error);	// request failed
				});
		});
	}

	getGasMeter(host, port, username, password, electricityId, gasId) {
		this.host = host || this.host;
		this.port = port || this.port;
		this.username = username || this.username;
		this.password = password || this.password;
		this.electricityId = electricityId || this.electricityId;
		this.gasId = gasId || this.gasId;
		return new Promise((resolve, reject) => {
			this._makeRequest(meterPath + this.gasId)
				.then((result) => {
					const readings = {};
					try {
						const responseJson = JSON.parse(result.body);
						const counter = responseJson.result[0].Counter;
						const counterToday = Number.parseFloat(responseJson.result[0].CounterToday);
						const updateTime = responseJson.result[0].LastUpdate;

						const gas = this.precisionRound(Number(counter));
						const gasTm = this.formatDate(updateTime);

						readings.g = {
							gas,
							gasTm,
							gasToday: counterToday
						};
					} catch (error) {
						// util.log('no gas readings available');
					}
					return resolve(readings);
				})
				.catch((error) => {
					console.log(error);
					reject(error);	// request failed
				});
		});
	}

	_makeRequest(action) {
		return new Promise((resolve, reject) => {
			const headers = {
				Connection: 'keep-alive',
			};
			const options = {
				hostname: this.host,
				port: this.port,
				path: action,
				auth: `${this.username}:${this.password}`,
				headers,
				method: 'GET',
			};
			const req = http.request(options, (res) => {
				const { statusCode } = res;
				const contentType = res.headers['content-type'];
				let error;
				if (statusCode === 401) {
					error = new Error('401 Unauthorized (wrong username/password)');
				} else if (statusCode !== 200) {
					error = new Error(`Request Failed. Status Code: ${statusCode}`);
				} else if (!/^application\/json/.test(contentType)) {
					error = new Error(`Invalid content-type. Expected application/json but received ${contentType}`);
				}
				if (error) {
					// consume response data to free up memory
					res.resume();
					reject(error);
					return;
				}
				let resBody = '';
				res.on('data', (chunk) => {
					resBody += chunk;
				});
				res.on('end', () => {
					res.body = resBody;
					resolve(res); // resolve the request
				});
			});
			req.on('error', (e) => {
				reject(e);
			});
			req.setTimeout(8000, () => {
				req.abort();
				reject(Error('Connection timeout'));
			});
			req.end();
		});
	}

}

module.exports = DomoticzP1;

/*

meter JSON:
{ e:
   { measurePower: 1130,
     measurePowerProduced: 0,
     powerPeak: 7173.526,
     powerOffpeak: 10694.674,
     powerPeakProduced: 2979.339,
     powerOffpeakProduced: 1100.755,
     powerTm: 1490625300000 },
  g: { gas: 4977.361, gasTm: 1490623200000 }
}

*/