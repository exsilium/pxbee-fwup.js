const xbeeApi = require('xbee-api');

const SerialPort = require(`serialport${process.env.NODE_ENV == 'test' ? '/test' : ''}`);
const handleExit = require('./handle-exit.js');

module.exports = function handleBypass(program) {
  console.log('Entering bypass handling!'.underline.green);

  const C = xbeeApi.constants;
  const xbeeAPI = new xbeeApi.XBeeAPI({
    api_mode: 1,
  });

  const port = new SerialPort(program.device, {
    baudRate: parseInt(program.baudrate, 10),
    parser: xbeeAPI.rawParser(),
  });

  port.on('open', () => {
    port.write(Buffer.from([0x42])); // B (Go to Bypass)

    const frameObject = {
      type: C.FRAME_TYPE.AT_COMMAND,
      command: 'NI',
      commandParameter: [],
    };

    port.write(xbeeAPI.buildFrame(frameObject));

    xbeeAPI.on('frame_object', (frame) => {
      console.log('>>'.yellow, frame);

      if (frame.commandStatus === 0) {
        console.log('Successfully entered Bypass mode, exiting'.green);
        handleExit(port);
      }
    });
  });

  return port;
};
