module.exports = function handleFirmware(program) {
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
          gauge.show((Math.floor(status.block / 101) + 1) + '/' + (Math.floor(totalBlocks / 101) + 1), (status.block % 101) / 100);
        }
        else {
          gauge.pulse('Sending: ' + status.signal);
        }
      }
      else if(status.action === 'recv') {
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
