"use strict";
const path = require('path');

let cluster = {
	adapter: require('db-cluster-mysql'),
	driver: require('mysql'),
	global: {
		user: 'root',
		database: "db-cluster-controller-test-" + process.pid
	},
	pools: {
		master: {},
		slave: {}
	}
};
let ctrl;

describe('Basic tests', function () {

	this.timeout(10000);


	it('Needs to return ctrl object', (done) => {
		ctrl = require('../index')(
			cluster,
			path.resolve(__dirname,'/structure.sql')
		);
		if(ctrl.setup && ctrl.shutdown && ctrl.teardown) {
			done();
		} else {
			done('Unexpected response');
		}
	});

	it('Needs to create database', (done) => {

		let structure = require('fs').readFileSync(__dirname + '/db/structure.sql').toString();

		ctrl = require('../index')(
			cluster,
			structure
		);
		ctrl.setup((e) => {
			done(e);
		});
	});

	it('Needs to create database and teardown the cluster', (done) => {

		let structure = require('fs').readFileSync(__dirname + '/db/structure.sql').toString();

		ctrl = require('../index')(
			cluster,
			structure
		);
		ctrl.setup((e) => {
			if(e) {
				return done(e);
			}
			ctrl.teardown((e) => {
				done(e);
			})

		});
	});


	it('Needs to create database with data', (done) => {

		let structure = require('fs').readFileSync(__dirname + '/db/structure.sql').toString();

		ctrl = require('../index')(
			cluster,
			structure,
			require('./data/file1.js')()
		);
		ctrl.setup((e) => {
			if(e) {
				return done(e);
			}
			ctrl.teardown((e) => {
				done(e);
			})

		});
	});


	afterEach((done) => {
		if(ctrl.teardown) {
			ctrl.teardown((e) => {
				if(e) {
					if (e.message === 'Cannot enqueue Query after invoking quit.') {
						done();
					} else {
						done(e);
					}
				} else {
					done();
				}
			})
		} else {
			done();
		}
	})
});
