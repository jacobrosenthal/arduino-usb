'use strict';

var Board = require('./lib/board');

function arduinousb(app, opts, cb){

  var namespace = opts.namespace || 'arduinousb';

  var board = new Board();

  app.expose(namespace, board);

  cb();
}

module.exports = arduinousb;
