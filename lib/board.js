'use strict';

var usbtinyisp = require('usbtinyisp');
var ihex = require('intel-hex');
var when = require('when');
var nodefn = require('when/node');
var rest = require('rest');
var errorCode = require('rest/interceptor/errorCode');
var defaultRequest = require('rest/interceptor/defaultRequest');
var mime = require('rest/interceptor/mime');
var pathPrefix = require('rest/interceptor/pathPrefix');

var postClient = rest
            .wrap(pathPrefix, { prefix: 'http://45.55.129.239/compile' })
            .wrap(mime, { mime: 'application/json' })
            .wrap(errorCode)
            .wrap(defaultRequest, { method: 'POST' });

var revisions = require('./revisions');

function Board(){
}

Board.prototype.bootload = function bootload(options, cb){
  return nodefn.bindCallback(when.promise(function(resolve, reject) {

    if(!options){
      return reject('Options error: no options');
    }

    if(!options.pid)
    {
      return reject('Options error: no pid');
    }

    if(!options.vid)
    {
      return reject('Options error: no vid');
    }

    if(!options.memory || !options.memory.data)
    {
      return reject('Options error: no program data');
    }

    if(!options.board)
    {
      return reject('Options error: no board');
    }

    var tinyAVR;

    function open(){
      return when.promise(function(resolve, reject) {
        tinyAVR = new usbtinyisp(options);
        tinyAVR.open(function(err){
          if(err){ return reject(err); }
          return resolve();
        });
      });
    }

    function close(){
      return when.promise(function(resolve) {
        tinyAVR.close();
        return resolve();
      });
    }

    function setSCK(){
      return when.promise(function(resolve, reject) {
        tinyAVR.setSCK(function(err){
          if(err){ return reject(err); }
          return resolve();
        });
      });
    }

    function sendSync(){
      return when.promise(function(resolve, reject) {
        tinyAVR.spi(new Buffer([0xac, 0x53, 0x00, 0x00]), function(err){
          if(err){ return reject(err); }
          return resolve();
        });
      });
    }

    function sync(){

      return setSCK()
      .delay(50)
      .then(sendSync);
    }

    function getSignature1(){
      return when.promise(function(resolve, reject) {
        tinyAVR.spi(new Buffer([0x30, 0x00, 0x00, 0x00]), function(err, sig){
          if(err){ return reject(err); }
          return resolve(sig);
        });
      });
    }

    function getSignature2(){
      return when.promise(function(resolve, reject) {
        tinyAVR.spi(new Buffer([0x30, 0x00, 0x01, 0x00]), function(err, sig){
          if(err){ return reject(err); }
          return resolve(sig);
        });
      });
    }

    function getSignature3(){
      return when.promise(function(resolve, reject) {
        tinyAVR.spi(new Buffer([0x30, 0x00, 0x02, 0x00]), function(err, sig){
          if(err){ return reject(err); }
          return resolve(sig);
        });
      });
    }

    function verifySignature(){

      return getSignature1()
      .then(function(sig){
        if(options.board.signature[0] !== sig[3]){
          throw new Error('Signature does not match');
        }
      })
      .then(getSignature2)
      .then(function(sig){
        if(options.board.signature[1] !== sig[3]){
          throw new Error('Signature does not match');
        }
      })
      .then(getSignature3)
      .then(function(sig){
        if(options.board.signature[2] !== sig[3]){
          throw new Error('Signature does not match');
        }
      });
    }

    function erase(){
      return when.promise(function(resolve, reject) {
        tinyAVR.spi(new Buffer([0xac, 0x80, 0x00, 0x00]), function(err){
          if(err){ return reject(err); }
          return resolve();
        });
      });
    }

    function powerDown(){
      return when.promise(function(resolve, reject) {
        tinyAVR.powerDown(function(err){
          if(err){ return reject(err); }
          return resolve();
        });
      });
    }

    function upload(){

      var writeBytes = new Buffer(0);
      var useaddr;
      var pageaddr;

      function loadPage() {
        return when.promise(function(resolve, reject) {
          tinyAVR.writeFlash(0, pageaddr, writeBytes, function(err, result){
            if(err){ return reject(err); }
            return resolve();
          });
        });
      }

      function loadAddress() {
        return when.promise(function(resolve, reject) {
          var low = useaddr & 0xff;
          var high = (useaddr >> 8) & 0xff;

          var cmd = new Buffer([0x4c, high, low, 0x00]);

          tinyAVR.spi(cmd, function(err, result){
            if(err){ return reject(err); }
            return resolve();
          });

        });
      }

      function unspool(index) {
        return [index, index + options.board.pageSize];
      }

      function predicate(index) {
        return index > options.memory.data.length;
      }

      function handler(index) {

        pageaddr = index;
        useaddr = index >> 1;
        writeBytes = options.memory.data.slice(pageaddr, (options.memory.data.length > options.board.pageSize ? (pageaddr + options.board.pageSize) : options.memory.data.length - 1));

        return loadPage()
        .then(loadAddress)
        .delay(4);
      }

      return when.unfold(unspool, predicate, handler, 0);
    }

    open()
    .then(sync)
    .then(verifySignature)
    .then(erase)
    .then(sync)
    .then(upload)
    .then(powerDown)
    .finally(close)
    .then(function(results){
      return resolve(results);
    },
    function(error){
      return reject(error);
    });

  }), cb);
};


//stub for now -- returns pre compiled data
Board.prototype.compile = function bootload(options, cb){

  var promise = postClient({
      entity: {board: options.board, source: options.source}
    })
  .then(function (response) {


    //check for some kind of error

    var memory = {
      type: 'flash',
      data: ihex.parse(response.entity).data
    };

    return memory;
  });

  return nodefn.bindCallback(promise, cb);
};

Board.prototype.getRevisions = function getRevisions(cb){
  return nodefn.bindCallback(when.promise(function(resolve, reject) {
    return resolve(revisions);
  }), cb);
};

module.exports = Board;
