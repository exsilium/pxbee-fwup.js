const VERSION = require('../package.json').version;
const program = require('commander');
const SerialPort = require('serialport');
const fs = require('fs');
const handleExit = require('./handle-exit.js');
const handleBypass = require('./handle-bypass.js');
const handleFirmware = require('./handle-firmware.js');

require('colors');
require('./handle-sigterm.js');
require('console-stamp')(console);

program
  .version(VERSION)
  .option('-d, --device [devlink]', 'Device node [/dev/cu.usbserial]')
  .option('-b, --baudrate [rate]', 'Baud rate [9600]', '9600')
  .option('-s, --skipInit', 'Skip Init (e.g. you know the module to be in the Bootloader menu)')
  .option('-B, --bypass', 'Go to bypass mode')
  .option('-F, --firmware <file>', 'Start Firmware Upgrade (NOT IMPLEMENTED)')
  .on('--help', () => {
    console.log('  Examples:');
    console.log('');
    console.log('    $ fwup -d /dev/cu.usbserial-AH02JYJT -b 9600');
    console.log('    $ fwup -d /dev/cu.usbserial-AH02JYJT -b 9600 -B');
    console.log('    $ fwup -d /dev/cu.usbserial-AH02JYJT -b 9600 -F path/to/file.abs.bin');
    console.log('');
  })
  .parse(process.argv);

if (program.device) {
  console.log('************************************************************');
  console.log(`* Programmable XBee Firmware Upgrade Tool v${VERSION}           *`);
  console.log('************************************************************');
  console.log('Settings used:'.underline.green);
  console.log('  - ', program.device);
  console.log('  - ', program.baudrate);
  if (program.skipInit) {
    console.log('  -  Skipping Init');
  }
  console.log('Action selected:'.underline.green);
  if (program.bypass) {
    console.log('  -  Bypass ');
  } else if (program.firmware) {
    console.log(`  -  Application Firmware Upgrade: ${program.firmware}`);
    // Check that the file exists
    if (!fs.existsSync(program.firmware)) {
      console.log(`${'ERROR:'.underline.red} Firmware file does not exist - ${program.firmware}`);
      process.exit();
    }
    // We should do further analysis of the file so that we don't try to
    // upload crap to the module
  } else {
    console.log('  -  NONE'.yellow);
  }

  const port = new SerialPort(program.device, {
    baudRate: parseInt(program.baudrate, 10),
  });

  let buffer;

  // Register for incoming data
  const dataHandler = (data) => {
    buffer += data.toString().replace('\r', '\n');
  };

  port.on('data', dataHandler);

  const nullData = Buffer.from([0x00]);
  const carrData = Buffer.from([0x0d]);
  let myInterval;

  port.on('open', () => {
    if (program.skipInit) {
      console.log('Port successfully opened, skipping init!'.bold.green);
      port.close();
      if (program.bypass) handleBypass(program);
      else if (program.firmware) handleFirmware(program);
      else handleExit(port);
    } else {
      console.log('Port is open please reset within 5 seconds!'.bold.green);
      port.set({ dtr: true, rts: false, brk: true }, () => {
        myInterval = setInterval(() => {
          port.write(nullData);
          setTimeout(() => {
            port.write(nullData);
            setTimeout(() => {
              port.write(carrData);
            }, 390);
          }, 415);
        }, 900);
        setTimeout(() => {
          let verBootloader;
          let verApp;

          console.log('Time is up!'.bold.yellow);
          buffer = '';
          clearInterval(myInterval);
          port.set({ brk: false });

          setTimeout(() => {
            port.write(carrData);
            setTimeout(() => {
              console.log(`\n=======\n${buffer}\n=======\n`);
              buffer = '';
              port.write(Buffer.from([0x56])); // V
              setTimeout(() => {
                // The bootloader echoes back the commands, thus we substring
                verBootloader = buffer.substr(1);
                if (verBootloader.indexOf('BL0') >= 0) {
                  console.log(`Bootloader Version: ${verBootloader.underline.green}`);
                } else {
                  console.log(`Bootloader Version: ${verBootloader.underline.yellow}`);
                }

                buffer = '';
                port.write(Buffer.from([0x41])); // A
                setTimeout(() => {
                  verApp = buffer.substr(1);
                  if (verApp.indexOf('Unknown') >= 0) {
                    console.log(`Application Version: ${verApp.underline.yellow}`);
                  } else {
                    console.log(`Application Version: ${verApp.underline.green}`);
                  }
                  buffer = '';

                  port.close();

                  // TODO: We need to check if we got into a bootloader or not before continuing
                  if (program.bypass) handleBypass(program);
                  else if (program.firmware) handleFirmware(program);
                  else handleExit(port);
                }, 100);
              }, 100);
            }, 500);
          }, 100);
        }, 5000);
      });
    } // End of Init
  });
} else {
  program.outputHelp();
  process.exit();
}

exports.VERSION = VERSION;
