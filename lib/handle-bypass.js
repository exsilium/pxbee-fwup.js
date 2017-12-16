module.exports = function handleBypass(program) {
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
