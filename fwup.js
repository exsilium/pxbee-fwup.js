#!/usr/bin/env node

const VERSION = require('./package.json').version;
const program = require('commander');
const colors = require('colors');

(function(o){
  if(o.__ts__){return;}
  var slice = Array.prototype.slice;
  ['log', 'debug', 'info', 'warn', 'error'].forEach(function(f){
    var _= o[f];
    o[f] = function(){
      var args = slice.call(arguments);
      args.unshift(new Date().toISOString());
      return _.apply(o, args);
    };
  });
  o.__ts__ = true;
})(console);

program
  .version(VERSION)
  .option('-d, --device [devlink]', 'Device node [/dev/cu.usbserial]')
  .option('-b, --baudrate [rate]', 'Baud rate [9600]', '9600')
  .option('-B, --bypass', 'Go to bypass mode (NOT IMPLEMENTED)')
  .option('-F, --firmware', 'Start Firmware Upgrade (NOT IMPLEMENTED)')
  .on('--help', function() {
    console.log('  Examples:');
    console.log('');
    console.log('    $ fwup.js -d /dev/cu.usbserial-AH02JYJT -b 9600');
    console.log('    $ fwup.js -d /dev/cu.usbserial-AH02JYJT -b 9600 -B');
    console.log('');
  })
  .parse(process.argv);

if(program.device) {
  console.log('Settings used:'.underline.green);
  console.log('  - ', program.device);
  console.log('  - ', program.baudrate);

  var SerialPort = require('serialport');
  var port = new SerialPort(program.device, {
    baudRate: parseInt(program.baudrate)
  });

  var buffer;

  // Register for incoming data
  port.on('data', function (data) {
    buffer += data.toString().replace('\r', '\n');
  });

  var nullData = new Buffer([0x00]);
  var carrData = new Buffer([0x0d]);
  var myInterval;

  port.on('open', function() {
    console.log("Port is open please reset within 5 seconds!".bold.green);
    port.set({dtr:true, rts:false, brk:true}, function() {
      myInterval = setInterval(function() {
        port.write(nullData);
        setTimeout(function() {
          port.write(nullData);
          setTimeout(function() {
            port.write(carrData);
          }, 390);
        }, 415);
      }, 900);
      setTimeout(function() {
        console.log('Time is up!'.bold.yellow);
        buffer = '';
        clearInterval(myInterval);
        port.set({brk:false});
        setTimeout(function() {
          port.write(carrData);
          setTimeout(function() {
            console.log('\n=======\n' + buffer + '\n=======\n');
            buffer = '';
            port.write(new Buffer([0x56])); //V
            setTimeout(function() {
              // The bootloader echoes back the commands, thus we substring
              console.log('Bootloader Version: ' + buffer.substr(1));
              buffer = '';
              port.write(new Buffer([0x41])); //A
              setTimeout(function() {
                console.log('Application Version: ' + buffer.substr(1));
                buffer = '';
                port.close();
              }, 100);
            }, 100);
          }, 500);
        }, 100)
      }, 5000);
    });
  });
}
else {
  program.outputHelp();
  process.exit();
}

exports.VERSION = VERSION;
