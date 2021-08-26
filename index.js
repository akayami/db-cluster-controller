'use strict';
const async = require('async');
const clone = require('clone');

module.exports = function (clusterConfig, structureString, dataArray) {

	const cfg = {
		adapter: clusterConfig.adapter,
		driver: clusterConfig.driver,
		global: clone(clusterConfig.global),
		pools: clusterConfig.pools
	};

	const dbname = cfg.global.database;
	delete cfg.global.database;

	let cluster, cluster_real, internalConn, realConn;

	return {
		setup: (...args) => {
			const cb = args.pop();
			const data = args.pop();
			if (data) {
				dataArray = data;
			}
			cluster = require('db-cluster')(cfg);
			cluster_real = require('db-cluster')(clusterConfig);
			cluster.master(function (err, conn) {
				if (err) {
					return cb(err);
				}
				internalConn = conn;

				const tasks = [
					function (asyncCB) {
						asyncCB(null, conn);
					},
					function (conn, asyncCB) {
						conn.query('DROP DATABASE IF EXISTS ??', [dbname], function (err, result) {
							if (err) {
								asyncCB(err);
							} else {
								asyncCB(null, conn);
							}
						});
					},
					function (conn, asyncCB) {
						conn.query('CREATE DATABASE ??', [dbname], function (err, result) {
							if (err) {
								asyncCB(err);
							} else {
								asyncCB(null, conn, result);
							}
						});
					}
					//,
					// function(conn, result, asyncCB) {
					// 	conn.query('USE ??', [dbname], function(err, result) {
					// 		if (err) {
					// 			asyncCB(err);
					// 		} else {
					// 			asyncCB(null, conn, result);
					//
					// 		}
					// 	})
					// }
				];

				async.waterfall(tasks, function (err, result) {
					if (err) {
						return cb(err);
					}
					cluster_real.master(function (err, conn) {
						if (err) {
							return cb(err);
						}
						realConn = conn;
						//console.log(realConn);
						const mocker = require('mock-db-generator')(
							realConn,
							dbname,
							String(structureString).split(';')
						);
						if (dataArray) {
							mocker.make(clone(dataArray));
						}
						mocker.run(function (err) {
							cb(err);
						});
					});
				});
			});
		},
		shutdown: function (cb, wrapper) {
			realConn.release(function (err) {
				cluster.end(function (err) {
					if (err) {
						return cb(err);
					}
					internalConn.release(function () {
						cluster_real.end(function (err) {
							cb(err);
						});
					});
				});
			});
		},

		teardown: function (cb, wrapper) {
			if (!realConn) {
				return cb();
			}
			realConn.release(function (e) {
				cluster_real.end(function (err) {
					if (err) {
						return cb(err);
					}
					if (e) {
						return cb(e);
					}
					internalConn.query('DROP DATABASE IF EXISTS ??', [dbname], function (err, result) {
						if (err) {
							return cb(err);
						}
						internalConn.release(function () {
							cluster.end(function (err) {
								return cb(err);
							});
						});
					});
				});
			});
		}
	};
};