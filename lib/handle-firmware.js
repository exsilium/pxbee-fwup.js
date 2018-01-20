const SerialPort = require('serialport');
const Gauge = require('gauge');
const handleExit = require('./handle-exit.js');
const xmodem = require('xmodem.js');
const fs = require('fs');

module.exports = function handleFirmware(program) {
  console.log('Entering firmware handling!'.underline.green);

  const gauge = new Gauge();
  xmodem.block_size = 64; // XBee uses non-standard block size
  const buffer = fs.readFileSync(program.firmware);
  let totalBlocks = 0;

  const port = new SerialPort(program.device, {
    baudRate: parseInt(program.baudrate, 10),
  });

  port.once('open', () => {
    xmodem.once('ready', (bufferLength) => {
      totalBlocks = bufferLength;
      // Progress bar + 2 for edges
      const template = [
        { type: 'progressbar', length: (bufferLength >= 100 ? 100 : bufferLength) + 2 },
        { type: 'activityIndicator', kerning: 1, length: 1 },
        { type: 'section', kerning: 1, default: '' },
        { type: 'subsection', kerning: 1, default: '' },
      ];
      gauge.setTemplate(template);
      gauge.setTheme('colorBrailleSpinner');
      gauge.show(`1/${Math.floor(bufferLength / 101) + 1}`, 0);
      const pulseConfirm = setInterval(() => {
        gauge.pulse(`Ready to send ${bufferLength} blocks. Press ${'[ENTER]'.red} to start transfer or ${'[CTRL-C]'.green} to cancel!`);
      }, 1000);

      const { stdin } = process;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      const upgradeConfirm = (key) => {
        // CTRL-C
        if (key === '\u0003') {
          handleExit(port);
        } else if (key === '\u000d') {
          clearInterval(pulseConfirm);
          stdin.removeListener('data', upgradeConfirm);
          stdin.setRawMode(false);
          stdin.resume();
          gauge.pulse('Initiating transmission');
          // At this stage, we should write F to the port (Bootloader menu for Firmware upgrade);
          setTimeout(() => {
            port.write(Buffer.from([0x46])); // F
          }, 1000);
        }
        process.stdout.write(key);
      };

      stdin.on('data', upgradeConfirm);

      console.log(`${'WARNING!'.underline.yellow} HERE BE DRAGONS!`);
    });

    xmodem.once('start', (mode) => {
      gauge.pulse(`Starting transmission mode: ${mode}`);
    });

    xmodem.on('status', (status) => {
      if (status.action === 'send') {
        if (status.signal === 'SOH') {
          gauge.show(`${Math.floor(status.block / 101) + 1}/${Math.floor(totalBlocks / 101) + 1}`, (status.block % 101) / 100);
        } else {
          gauge.pulse(`Sending: ${status.signal}`);
        }
      } else if (status.action === 'recv') {
        gauge.pulse(`Received: ${status.signal}`);
      }
    });

    xmodem.on('stop', () => {
      gauge.hide();
      console.log('Sending completed! Exiting!');
      handleExit(port);
    });

    xmodem.send(port, buffer);
  });
};
