#!/usr/bin/env node

const VERSION = require('./package.json').version;
const program = require('commander');

const SerialPort = require('serialport');
const xbee_api = require('xbee-api');

const colors = require('colors');
const fs = require('fs');

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
  .option('-s, --skipInit', 'Skip Init (e.g. you know the module to be in the Bootloader menu)')
  .option('-B, --bypass', 'Go to bypass mode')
  .option('-F, --firmware <file>', 'Start Firmware Upgrade (NOT IMPLEMENTED)')
  .on('--help', function() {
    console.log('  Examples:');
    console.log('');
    console.log('    $ fwup.js -d /dev/cu.usbserial-AH02JYJT -b 9600');
    console.log('    $ fwup.js -d /dev/cu.usbserial-AH02JYJT -b 9600 -B');
    console.log('');
  })
  .parse(process.argv);

if(program.device) {
  console.log('************************************************************');
  console.log('* Programmable XBee Firmware Upgrade Tool v' + require('./package.json').version + '           *');
  console.log('************************************************************');
  console.log('Settings used:'.underline.green);
  console.log('  - ', program.device);
  console.log('  - ', program.baudrate);
  if(program.skipInit) {
    console.log('  -  Skipping Init');
  }
  console.log('Action selected:'.underline.green);
  if(program.bypass) {
    console.log('  -  Bypass ');
  }
  else if(program.firmware) {
    console.log('  -  Application Firmware Upgrade: ' + program.firmware)
    // Check that the file exists
    if(!fs.existsSync(program.firmware)) {
      console.log('ERROR:'.underline.red + ' Firmware file does not exist - ' + program.firmware);
      process.exit();
    }
    // We should do further analysis of the file so that we don't try to
    // upload crap to the module
  }
  else {
    console.log('  -  NONE'.yellow);
  }

  var port = new SerialPort(program.device, {
    baudRate: parseInt(program.baudrate)
  });

  var buffer;

  // Register for incoming data
  var dataHandler = function (data) {
    buffer += data.toString().replace('\r', '\n');
  };
  
  port.on('data', dataHandler);

  var nullData = new Buffer([0x00]);
  var carrData = new Buffer([0x0d]);
  var myInterval;

  port.on('open', function() {
    if(program.skipInit) {
      console.log("Port successfully opened, skipping init!".bold.green);
      port.close();
      if(program.bypass) handleBypass();
      else if(program.firmware) handleFirmware();
      else handleExit();
    }
    else {
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
          var verBootloader, verApp;
          
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
                verBootloader = buffer.substr(1);
                if(verBootloader.indexOf('BL0') >= 0) {
                  console.log('Bootloader Version: ' + verBootloader.underline.green);
                }
                else {
                  console.log('Bootloader Version: ' + verBootloader.underline.yellow);
                }
  
                buffer = '';
                port.write(new Buffer([0x41])); //A
                setTimeout(function() {
                  verApp = buffer.substr(1);
                  if(verApp.indexOf('Unknown') >= 0) {
                    console.log('Application Version: ' + verApp.underline.yellow);
                  }
                  else {
                    console.log('Application Version: ' + verApp.underline.green);
                  }
                  buffer = '';
  
                  port.close();
  
                  // TODO: We need to check if we got into a bootloader or not before continuing
                  if(program.bypass) handleBypass();
                  else if(program.firmware) handleFirmware();
                  else handleExit();
                }, 100);
              }, 100);
            }, 500);
          }, 100);
        }, 5000);
      });
    } // End of Init
  });
}
else {
  program.outputHelp();
  process.exit();
}

function handleBypass() {
  console.log('Entering bypass handling!'.underline.green);

  var C = xbee_api.constants;
  var xbeeAPI = new xbee_api.XBeeAPI({
    api_mode: 1
  });

  port = new SerialPort(program.device, {
    baudRate: parseInt(program.baudrate),
    parser: xbeeAPI.rawParser()
  });

  port.on('open', function(){
    port.write(new Buffer([0x42])); // B (Go to Bypass)

    var frame_obj = {
      type: C.FRAME_TYPE.AT_COMMAND,
      command: "NI",
      commandParameter: [],
    };

    port.write(xbeeAPI.buildFrame(frame_obj));

    xbeeAPI.on("frame_object", function(frame) {
      console.log(">>".yellow, frame);

      if(frame.commandStatus === 0) {
        console.log("Successfully entered Bypass mode, exiting".green);
        handleExit();
      }
    });
  });
}

function handleFirmware() {
  console.log('Entering firmware handling!'.underline.green);
  
  var Gauge = require("gauge");
  var gauge = new Gauge();
  var xmodem = require("xmodem.js");
  xmodem.block_size = 64; // XBee uses non-standard block size
  var buffer = fs.readFileSync(program.firmware);
  var totalBlocks = 0;
  
  port = new SerialPort(program.device, {
    baudRate: parseInt(program.baudrate)
  });
  
  port.once('open', function(){
    
    xmodem.once('ready', function(bufferLength) {
      totalBlocks = bufferLength;
      // Progress bar + 2 for edges
      var template = [
        {type: 'progressbar', length: (bufferLength >= 100 ? 100 : bufferLength) + 2},
        {type: 'activityIndicator', kerning: 1, length: 1},
        {type: 'section', kerning: 1, default: ''},
        {type: 'subsection', kerning: 1, default: ''}
      ];
      gauge.setTemplate(template);
      gauge.setTheme("colorBrailleSpinner");
      gauge.show("1/" + (Math.floor(bufferLength / 101) + 1), 0);
      var pulseConfirm = setInterval(function() {
        gauge.pulse("Ready to send " + bufferLength + " blocks. Press " + "[ENTER]".red + " to start transfer or " + "[CTRL-C]".green + " to cancel!");
      }, 1000);
      
      var stdin = process.stdin;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding( 'utf8' );

      var upgradeConfirm = function(key) {
        // CTRL-C
        if (key === '\u0003') {
          handleExit();
        }
        else if(key === '\u000d') {
          clearInterval(pulseConfirm);
          stdin.removeListener('data', upgradeConfirm);
          stdin.setRawMode(false);
          stdin.resume();
          gauge.pulse("Initiating transmission");
          // At this stage, we should write F to the port (Bootloader menu for Firmware upgrade);
          setTimeout(function() {
            port.write(new Buffer([0x46])); //F
          }, 1000);
        }
        process.stdout.write( key );
      };
      
      stdin.on('data', upgradeConfirm);
      
      console.log("WARNING!".underline.yellow + " HERE BE DRAGONS!");
    });
    
    xmodem.once('start', function(mode) {
      gauge.pulse("Starting transmission mode: " + mode);
    });
    
    xmodem.on('status', function(status) {
      if(status.action === 'send') {
        if(status.signal === 'SOH') {
          gauge.show((Math.floor(status.block / 101) + 1) + '/' + (Math.floor(totalBlocks / 101) + 1),  status.block % 101);
        }
        else {
          gauge.pulse('Sending: ' + status.signal);
        }
      }
      else if(status.action === 'recv') {
        process.stdout.write('.');
        gauge.pulse('Received: ' + status.signal)
      };
    });
    
    xmodem.on('stop', function() {
      gauge.hide();
      console.log('Sending completed! Exiting!');
      handleExit();
    });
    
    xmodem.send(port, buffer);
  });
  
}

function handleExit() {
  if(port.readable) {
    port.close();
  }
  process.exit();
}

exports.VERSION = VERSION;
