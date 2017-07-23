# pxbee-fwup.js

A command line utility `fwup.js` for interacting with [Digi](https://www.digi.com)'s XBee radios that are 
equipped with an 8-bit microcontroller HCS08 for application logic. By default, the provided SDK is only operable
within Windows. So for Linux/MacOS alternative tooling is required.

*NB!* This is still a work-in-progress and no guarantees are given that this software works as intended.
Feel free to experiment but be careful and use this software only at your own risk!

## Demo

[![asciicast](https://asciinema.org/a/2BP9maFqVWEz2MdN37sb73KE4.png)](https://asciinema.org/a/2BP9maFqVWEz2MdN37sb73KE4)

## `fwup.js` features:

- Init sequence for the module to boot into Bootloader menu
- Going into Bypass mode (in this case the module can be operated as any standard XBee radio)
- HCS08 Firmware upgrade via XMODEM transfer

Planned featured (TBD):

- Over-the-air firmware upgrade

Expect to work with Programmable S2B modules as well as the following [S2C Modules](https://www.digi.com/products/xbee-rf-solutions/2-4-ghz-modules/xbee-zigbee#partnumbers):

- XB24CZ7PITB003
- XB24CZ7WITB003
- XB24CZ7UITB003
- XB24CZ7SITB003
- XB24CZ7PISB003
- XB24CZ7RISB003
- XB24CZ7UISB003
- XBP24CZ7PITB003
- XBP24CZ7WITB003
- XBP24CZ7SITB003
- XBP24CZ7PISB003
- XBP24CZ7RISB003
- XBP24CZ7UISB003

## Installation

This is still a work in progress so to install, clone this repo and run `npm install`

## Usage

Run `./fwup.js --help` for up to date utility options

# Other Projects

- [XBEE-SDK Documentation](https://github.com/exsilium/xbee-sdk-doc)
- [HCS08 Blink led project](https://github.com/exsilium/pxbee-blink-led)