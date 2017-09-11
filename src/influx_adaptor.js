const Influx = require('influx');
const log = require("loglevel");
const express = require('express');
const _ = require("lodash");


const INFLUX_URL = process.env.INFLUX_URL || "http://localhost:8086/heroku";

let DEBUG_WRITER = null;

exports._set_debug_writer = function(writer) {
    DEBUG_WRITER = writer;
};

function write(influxPoints) {
    if (DEBUG_WRITER) {
        DEBUG_WRITER(influxPoints);
        return Promise.resolve(influxPoints);
    } else {
        const influxClient = new Influx.InfluxDB(INFLUX_URL);
        return influxClient.writePoints(influxPoints);
    }
}
exports.write = write;


exports.init = function init(router) {
    log.info(`Use influxdb adapter at url: ${INFLUX_URL}`);
    router.post('/write/:source', (req, res) => {
        const points = (req.body || []).map((p) => {
            const new_point = {
                measurement: p.measurement,
                fields: p.fields,
                tags: Object.assign({
                    'source': req.params.source
                }, req.query || {}, p.tags || {}),
            };
            // sanitize tags and fields, disallow empty string
            new_point.tags = _.pickBy(new_point.tags, (v, k) => {
                return v !== "" && v !== null;
            });
            if (p.timestamp) {
                // ensure we don't put timestamp if null or undefined or 0
                new_point.timestamp = new Date(p.timestamp)
            }
            return new_point;
        });
        write(points)
            .then(() => {
                res.status(204).end();
            })
            .catch((ex) => {
                res.status(400).send(ex.message);
            })
    });
    return router;
};

exports.send = function send(points) {
    const influxPoints = points.map((p) => {
        const fields = p.value !== undefined ? {value: p.value} : {};
        return {
            measurement: p.name,
            tags: p.tags,
            fields: Object.assign(fields, p.fields || {}),
            timestamp: p.timestamp
        };
    });
    return write(influxPoints);
};

