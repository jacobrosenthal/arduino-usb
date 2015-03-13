'use strict';

var usbtinyisp = require('usbtinyisp');
var async = require('async');
var ihex = require('intel-hex');

var revisions = require('./revisions');

function Board(){
}

Board.prototype.bootload = function bootload(options, cb){

  if(!options){
    return(cb('Options error: no options'));
  }

  if(!options.hasOwnProperty('pid'))
  {
    return cb('Options error: no pid');
  }

  if(!options.hasOwnProperty('vid'))
  {
    return cb('Options error: no vid');
  }

  if(!options.hasOwnProperty('memory') || !options.memory.hasOwnProperty('data'))
  {
    return cb('Options error: no program data');
  }

  if(!options.hasOwnProperty('board'))
  {
    return cb('Options error: no board');
  }

  var tinyAVR = new usbtinyisp(options);

  async.series([
    sync.bind(null, tinyAVR),
    getSignature.bind(null, tinyAVR),
    erase.bind(null, tinyAVR),
    sync.bind(null, tinyAVR),
    upload.bind(null, tinyAVR, options.memory.data, options.board.pageSize, 2000),
    tinyAVR.powerDown.bind(tinyAVR)

    ], function(error, results){

      // tinyAVR.close();
      return cb(error, results);
  });

};

var sync = function(tinyAVR, cb){

  async.series([
    tinyAVR.setSCK.bind(tinyAVR),
    function(cbdone){
      setTimeout(cbdone, 50);
    },
    tinyAVR.spi.bind(tinyAVR, new Buffer([0xac, 0x53, 0x00, 0x00])),
  ], function(error, results){
      cb(error, results);
  });
};

var getSignature = function(tinyAVR, cb){

  async.series([
    tinyAVR.spi.bind(tinyAVR, new Buffer([0x30, 0x00, 0x00, 0x00])),
    tinyAVR.spi.bind(tinyAVR, new Buffer([0x30, 0x00, 0x01, 0x00])),
    tinyAVR.spi.bind(tinyAVR, new Buffer([0x30, 0x00, 0x02, 0x00]))
  ], function(error, results){

      // undefined,
      // <Buffer 00 30 00 1e>,
      // <Buffer 00 30 00 93>,
      // <Buffer 00 30 00 0b> ] //signature is 1e 93 0b
      cb(error, results);
  });
};


var erase = function(tinyAVR, cb){
  tinyAVR.spi(new Buffer([0xac, 0x80, 0x00, 0x00]), cb);
};

var writeFuse = function(tinyAVR, buffer, cb){
  tinyAVR.spi(buffer, cb);
};

// //poll thing
// var something = function(tinyAVR, cb){
//  tinyAVR.spi(new Buffer([0xff, 0xff, 0x00, 0x00]), cb);
// };

function loadPage(tinyAVR, address, buffer, timeout, done) {
  tinyAVR.writeFlash(0, address, buffer, done);
}

function loadAddress(tinyAVR, useaddr, timeout, done) {

  var low = useaddr & 0xff;
  var high = (useaddr >> 8) & 0xff;

  var cmd = new Buffer([0x4c, high, low, 0x00]);
  tinyAVR.spi(cmd, done);
}

function upload(stream, hex, pageSize, timeout, done) {
  // console.log("program");

  var pageaddr = 0;
  var writeBytes;
  var useaddr;

  // program individual pages
  async.whilst(
    function() { return pageaddr < hex.length; },
    function(pagedone) {
      // console.log("program page");
      async.series([
        function(cbdone){
          useaddr = pageaddr >> 1;
          cbdone();
        },
        function(cbdone){
          writeBytes = hex.slice(pageaddr, (hex.length > pageSize ? (pageaddr + pageSize) : hex.length - 1));
          cbdone();
        },
        function(cbdone){
          loadPage(stream, pageaddr, writeBytes, timeout, cbdone);  
        },
        function(cbdone){
          loadAddress(stream, useaddr, timeout, cbdone);
        },
        function(cbdone){
          // console.log("programmed page");
          pageaddr =  pageaddr + writeBytes.length;
          setTimeout(cbdone, 4);
        }
      ],
      function(error) {
        // console.log("page done");
        pagedone(error);
      });
    },
    function(error) {
      // console.log("upload done");
      done(error);
    }
  );
}

//stub for now -- returns pre compiled data
Board.prototype.compile = function bootload(options, cb){
  var data = ":1000000023C032C031C030C02FC042C02DC02CC070\n:100010002BC02AC029C028C027C026C025C0010285\n:100020000000040000000000010204081020200469\n:100030001008020202020202020202020000000094\n:10004000380000000000370011241FBECFE5D2E0C9\n:10005000DEBFCDBF20E0A0E6B0E001C01D92A93612\n:10006000B207E1F748D152C1CBCF61E080E0D5C003\n:1000700061E080E00BD168EE73E080E090E076D044\n:1000800060E080E003D168EE73E080E090E06EC055\n:100090001F920F920FB60F9211242F933F938F93BD\n:1000A0009F93AF93BF938091610090916200A09164\n:1000B0006300B09164003091600020E3230F2D377E\n:1000C00020F44096A11DB11D05C023EB230F4196DE\n:1000D000A11DB11D20936000809361009093620088\n:1000E000A0936300B09364008091650090916600D6\n:1000F000A0916700B09168000196A11DB11D809389\n:10010000650090936600A0936700B0936800BF916C\n:10011000AF919F918F913F912F910F900FBE0F90B4\n:100120001F9018953FB7F8948091650090916600F4\n:10013000A0916700B091680022B708B601FE05C023\n:100140002F3F19F00196A11DB11D3FBF6627782FE3\n:10015000892F9A2F620F711D811D911D46E0660F38\n:10016000771F881F991F4A95D1F70895CF92DF9284\n:10017000EF92FF92CF93DF936B017C01D3DFEB0112\n:10018000C114D104E104F10479F0BFD0CBDF6C1BC2\n:100190007D0B683E7340A0F381E0C81AD108E108E6\n:1001A000F108C851DC4FECCFDF91CF91FF90EF9079\n:1001B000DF90CF90089578948AB582608ABD8AB521\n:1001C00081608ABD83B7826083BF83B7816083BF4C\n:1001D00089B7826089BF80B7826080BF329A319AC6\n:1001E000309A379A0895823081F018F4813051F0B6\n:1001F0000895833019F0843009F008958CB58F7D0F\n:100200008CBD08958AB58F7702C08AB58F7D8ABD6F\n:1002100008958CB580648CBD0895CF93DF9390E0F2\n:10022000FC01E85DFF4F2491FC01EE5CFF4F8491DF\n:10023000882349F190E0880F991FFC01EE5BFF4F86\n:10024000A591B491845C9F4FFC01C591D4919FB757\n:10025000611108C0F8948C91209582238C93888139\n:1002600082230AC0623051F4F8948C91322F309579\n:1002700083238C938881822B888304C0F8948C918B\n:10028000822B8C939FBFDF91CF9108950F931F9383\n:10029000CF93DF931F92CDB7DEB7282F30E0F9015F\n:1002A000E25EFF4F8491F901E85DFF4F1491F9017F\n:1002B000EE5CFF4F04910023C1F0882319F069839D\n:1002C00092DF6981E02FF0E0EE0FFF1FE45CFF4F4B\n:1002D000A591B4919FB7F8948C91611103C01095CA\n:1002E000812301C0812B8C939FBF0F90DF91CF9111\n:1002F0001F910F9108955FDF8CDFB7DEC0E0D0E083\n:10030000B7DE2097E9F37CDEFBCF0895F894FFCFAA\n:00000001FF";
  var memory =  {
    type: 'flash',
    data: ihex.parse(data).data
  };
  cb(null, memory);
};

Board.prototype.getRevisions = function getRevisions(cb){
  cb(null, revisions);
};

module.exports = Board;
